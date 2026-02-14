use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use utoipa::ToSchema;

use crate::backup::{self};
use crate::error::PaymeError;
use crate::middleware::auth::Claims;

#[derive(Serialize, ToSchema)]
pub struct BackupResponse {
    pub filename: String,
    pub timestamp: String,
    pub size: String,
    pub size_bytes: u64,
}

#[derive(Serialize, ToSchema)]
pub struct BackupListResponse {
    pub backups: Vec<BackupResponse>,
    pub total_count: usize,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateBackupRequest {
    pub reason: Option<String>,
}

#[utoipa::path(
    post,
    path = "/api/backups/create",
    request_body = CreateBackupRequest,
    responses(
        (status = 200, body = BackupResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Backups",
    summary = "Create a new database backup",
    description = "Creates an immediate backup of the current database."
)]
pub async fn create_backup(
    State(pool): State<SqlitePool>,
    axum::Extension(_claims): axum::Extension<Claims>,
    Json(_payload): Json<CreateBackupRequest>,
) -> Result<Json<BackupResponse>, PaymeError> {
    let db_path = "/data/payme.db";

    backup::init_backups_dir().map_err(|e| {
        PaymeError::Internal(format!("Failed to initialize backups directory: {}", e))
    })?;

    let backup_info = backup::create_database_backup(&pool, db_path)
        .await
        .map_err(|e| PaymeError::Internal(format!("Failed to create backup: {}", e)))?;

    // Clean up old backups, keep last 30
    let _ = backup::cleanup_old_backups(30);

    Ok(Json(BackupResponse {
        filename: backup_info.filename,
        timestamp: backup_info.timestamp,
        size: backup::format_size(backup_info.size_bytes),
        size_bytes: backup_info.size_bytes,
    }))
}

#[utoipa::path(
    get,
    path = "/api/backups/list",
    responses(
        (status = 200, body = BackupListResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Backups",
    summary = "List all available backups",
    description = "Returns a list of all database backups, sorted by date (newest first)."
)]
pub async fn list_backups(
    axum::Extension(_claims): axum::Extension<Claims>,
) -> Result<Json<BackupListResponse>, PaymeError> {
    let backups = backup::list_backups()
        .map_err(|e| PaymeError::Internal(format!("Failed to list backups: {}", e)))?;

    let backup_responses: Vec<BackupResponse> = backups
        .into_iter()
        .map(|b| BackupResponse {
            filename: b.filename.clone(),
            timestamp: b.timestamp,
            size: backup::format_size(b.size_bytes),
            size_bytes: b.size_bytes,
        })
        .collect();

    Ok(Json(BackupListResponse {
        total_count: backup_responses.len(),
        backups: backup_responses,
    }))
}

#[utoipa::path(
    delete,
    path = "/api/backups/{filename}",
    params(("filename" = String, Path)),
    responses(
        (status = 200, description = "Backup deleted successfully"),
        (status = 400, description = "Invalid backup filename"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Backup not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Backups",
    summary = "Delete a backup",
    description = "Permanently deletes a backup file."
)]
pub async fn delete_backup(
    axum::extract::Path(filename): axum::extract::Path<String>,
    axum::Extension(_claims): axum::Extension<Claims>,
) -> Result<StatusCode, PaymeError> {
    // Validate filename format
    if !filename.starts_with("payme_") || !filename.ends_with(".db") {
        return Err(PaymeError::BadRequest(
            "Invalid backup filename format".to_string(),
        ));
    }

    let deleted = backup::delete_backup(&filename)
        .map_err(|e| PaymeError::Internal(format!("Failed to delete backup: {}", e)))?;

    if deleted {
        Ok(StatusCode::OK)
    } else {
        Err(PaymeError::NotFound)
    }
}

#[utoipa::path(
    post,
    path = "/api/backups/{filename}/restore",
    params(("filename" = String, Path)),
    request_body = RestoreBackupRequest,
    responses(
        (status = 200, description = "Backup restored successfully"),
        (status = 400, description = "Invalid backup filename"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Backup not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Backups",
    summary = "Restore from a backup",
    description = "Restores the database from a previous backup. This will overwrite current data."
)]
pub async fn restore_backup(
    State(pool): State<SqlitePool>,
    axum::extract::Path(filename): axum::extract::Path<String>,
    axum::Extension(_claims): axum::Extension<Claims>,
    Json(_payload): Json<RestoreBackupRequest>,
) -> Result<StatusCode, PaymeError> {
    // Validate filename format
    if !filename.starts_with("payme_") || !filename.ends_with(".db") {
        return Err(PaymeError::BadRequest(
            "Invalid backup filename format".to_string(),
        ));
    }

    let backups_dir = backup::get_backups_dir();
    let backup_path = backups_dir.join(&filename);

    // Verify file exists and is in the right directory
    if !backup_path.starts_with(&backups_dir) || !backup_path.exists() {
        return Err(PaymeError::NotFound);
    }

    let db_path = "/data/payme.db";

    // Close all database connections
    pool.close().await;

    // Restore from backup
    std::fs::copy(&backup_path, db_path)
        .map_err(|e| PaymeError::Internal(format!("Failed to restore backup: {}", e)))?;

    Ok(StatusCode::OK)
}

#[derive(Deserialize, ToSchema)]
pub struct RestoreBackupRequest {
    pub confirm: Option<bool>,
}
