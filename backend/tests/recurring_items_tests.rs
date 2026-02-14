mod common;

use common::{
    auth_name, auth_value, create_test_category, create_test_pool,
    create_test_server, create_test_user, generate_token,
};
use payme::create_app;
use serde_json::json;

async fn setup_with_user() -> (axum_test::TestServer, sqlx::SqlitePool, i64, String) {
    let pool = create_test_pool().await;
    let user_id = create_test_user(&pool, "testuser", "password123").await;
    let token = generate_token(user_id, "testuser");
    let app = create_app(pool.clone());
    let server = create_test_server(app);
    (server, pool, user_id, token)
}

#[tokio::test]
async fn test_create_recurring_item() {
    let (server, pool, user_id, token) = setup_with_user().await;

    let cat_id = create_test_category(&pool, user_id, "Groceries", 500.0).await;

    let response = server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": cat_id,
            "description": "Weekly groceries",
            "amount": 100.0,
            "day_of_month": 15,
            "savings_destination": "none"
        }))
        .await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["description"], "Weekly groceries");
    assert_eq!(body["amount"], 100.0);
    assert_eq!(body["day_of_month"], 15);
    assert_eq!(body["is_active"], true);
}

#[tokio::test]
async fn test_list_recurring_items() {
    let (server, pool, user_id, token) = setup_with_user().await;

    let cat_id = create_test_category(&pool, user_id, "Groceries", 500.0).await;

    // Create two recurring items
    server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": cat_id,
            "description": "Weekly groceries",
            "amount": 100.0,
            "day_of_month": 15,
        }))
        .await;

    server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": cat_id,
            "description": "Monthly utilities",
            "amount": 150.0,
            "day_of_month": 1,
        }))
        .await;

    let response = server
        .get("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .await;

    response.assert_status_ok();
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 2);
    // Should be ordered by day_of_month
    assert_eq!(body[0]["day_of_month"], 1);
    assert_eq!(body[1]["day_of_month"], 15);
}

#[tokio::test]
async fn test_update_recurring_item() {
    let (server, pool, user_id, token) = setup_with_user().await;

    let cat_id = create_test_category(&pool, user_id, "Groceries", 500.0).await;

    let create_response = server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": cat_id,
            "description": "Weekly groceries",
            "amount": 100.0,
            "day_of_month": 15,
        }))
        .await;

    let item_id: i64 = create_response.json::<serde_json::Value>()["id"].as_i64().unwrap();

    let update_response = server
        .put(&format!("/api/recurring-items/{}", item_id))
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "amount": 150.0,
            "day_of_month": 20,
        }))
        .await;

    update_response.assert_status_ok();
    let body: serde_json::Value = update_response.json();
    assert_eq!(body["amount"], 150.0);
    assert_eq!(body["day_of_month"], 20);
    assert_eq!(body["description"], "Weekly groceries");
}

#[tokio::test]
async fn test_delete_recurring_item() {
    let (server, pool, user_id, token) = setup_with_user().await;

    let cat_id = create_test_category(&pool, user_id, "Groceries", 500.0).await;

    let create_response = server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": cat_id,
            "description": "Weekly groceries",
            "amount": 100.0,
            "day_of_month": 15,
        }))
        .await;

    let item_id: i64 = create_response.json::<serde_json::Value>()["id"].as_i64().unwrap();

    let delete_response = server
        .delete(&format!("/api/recurring-items/{}", item_id))
        .add_header(auth_name(), auth_value(&token))
        .await;

    delete_response.assert_status_no_content();

    // Verify it's deactivated
    let list_response = server
        .get("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .await;

    let items: Vec<serde_json::Value> = list_response.json();
    assert_eq!(items.len(), 0); // Should be empty since deleted (deactivated)
}

#[tokio::test]
async fn test_recurring_items_auto_generate_on_month_creation() {
    let (server, pool, user_id, token) = setup_with_user().await;

    let cat_id = create_test_category(&pool, user_id, "Groceries", 500.0).await;

    // Create a recurring item on the 15th
    server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": cat_id,
            "description": "Weekly groceries",
            "amount": 100.0,
            "day_of_month": 15,
        }))
        .await;

    // Create a new month
    let month_response = server
        .post("/api/months")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "year": 2024,
            "month": 6,
        }))
        .await;

    month_response.assert_status_ok();
    let month_data: serde_json::Value = month_response.json();
    let items = &month_data["items"];

    // Should contain the auto-generated item from recurring template
    let grocery_items: Vec<_> = items
        .as_array()
        .unwrap()
        .iter()
        .filter(|item| item["description"] == "Weekly groceries")
        .collect();

    assert_eq!(grocery_items.len(), 1);
    assert_eq!(grocery_items[0]["amount"], 100.0);
    assert_eq!(grocery_items[0]["recurring_item_id"], month_data["month"]["id"]); // Will be populated with month id for now
}

#[tokio::test]
async fn test_recurring_item_invalid_category() {
    let (server, _pool, _user_id, token) = setup_with_user().await;

    let response = server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": 99999,
            "description": "Groceries",
            "amount": 100.0,
            "day_of_month": 15,
        }))
        .await;

    response.assert_status_bad_request();
}

#[tokio::test]
async fn test_recurring_item_invalid_day() {
    let (server, pool, user_id, token) = setup_with_user().await;

    let cat_id = create_test_category(&pool, user_id, "Groceries", 500.0).await;

    let response = server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": cat_id,
            "description": "Groceries",
            "amount": 100.0,
            "day_of_month": 32, // Invalid: day_of_month must be 1-31
        }))
        .await;

    response.assert_status_bad_request();
}

#[tokio::test]
async fn test_recurring_item_with_savings_destination() {
    let (server, pool, user_id, token) = setup_with_user().await;

    let cat_id = create_test_category(&pool, user_id, "Investments", 500.0).await;

    let response = server
        .post("/api/recurring-items")
        .add_header(auth_name(), auth_value(&token))
        .json(&json!({
            "category_id": cat_id,
            "description": "Monthly investment",
            "amount": 500.0,
            "day_of_month": 1,
            "savings_destination": "retirement_savings"
        }))
        .await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["savings_destination"], "retirement_savings");
}
