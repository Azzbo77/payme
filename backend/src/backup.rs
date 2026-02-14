use chrono::Utc;
use sqlx::SqlitePool;
use std::fs;
use std::path::PathBuf;

/// Backup metadata
#[derive(Debug, Clone)]
pub struct BackupInfo {
    pub filename: String,
    pub timestamp: String,
    pub size_bytes: u64,
}

/// Get the backups directory path
pub fn get_backups_dir() -> PathBuf {
    PathBuf::from("/data/backups")
}

/// Initialize the backups directory
pub fn init_backups_dir() -> std::io::Result<()> {
    let backups_dir = get_backups_dir();
    if !backups_dir.exists() {
        fs::create_dir_all(&backups_dir)?;
    }
    Ok(())
}

/// Create a timestamped backup of the database
pub async fn create_database_backup(
    pool: &SqlitePool,
    db_path: &str,
) -> Result<BackupInfo, Box<dyn std::error::Error>> {
    // Ensure database is synced
    sqlx::query("PRAGMA synchronous = FULL")
        .execute(pool)
        .await?;

    let backups_dir = get_backups_dir();
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("payme_{}.db", timestamp);
    let backup_path = backups_dir.join(&filename);

    // Copy the database file
    fs::copy(db_path, &backup_path)?;

    let metadata = fs::metadata(&backup_path)?;
    let size_bytes = metadata.len();

    Ok(BackupInfo {
        filename,
        timestamp,
        size_bytes,
    })
}

/// List all available backups, sorted by date (newest first)
pub fn list_backups() -> Result<Vec<BackupInfo>, Box<dyn std::error::Error>> {
    let backups_dir = get_backups_dir();

    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();

    for entry in fs::read_dir(&backups_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_file() {
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                if filename.starts_with("payme_") && filename.ends_with(".db") {
                    let metadata = fs::metadata(&path)?;
                    // Extract timestamp from filename (payme_YYYYMMDD_HHMMSS.db)
                    let timestamp = filename
                        .strip_prefix("payme_")
                        .and_then(|s| s.strip_suffix(".db"))
                        .unwrap_or("")
                        .to_string();

                    backups.push(BackupInfo {
                        filename: filename.to_string(),
                        timestamp,
                        size_bytes: metadata.len(),
                    });
                }
            }
        }
    }

    // Sort by timestamp descending (newest first)
    backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(backups)
}

/// Delete a backup file by filename
pub fn delete_backup(filename: &str) -> Result<bool, Box<dyn std::error::Error>> {
    // Validate filename to prevent directory traversal
    if !filename.starts_with("payme_") || !filename.ends_with(".db") || filename.contains("..") {
        return Ok(false);
    }

    let backups_dir = get_backups_dir();
    let backup_path = backups_dir.join(filename);

    // Verify the file is actually in the backups directory
    if !backup_path.starts_with(&backups_dir) {
        return Ok(false);
    }

    if backup_path.exists() {
        fs::remove_file(&backup_path)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Clean up old backups, keeping only the most recent `keep_count` backups
pub fn cleanup_old_backups(keep_count: usize) -> Result<(), Box<dyn std::error::Error>> {
    let backups = list_backups()?;

    if backups.len() > keep_count {
        // Remove older backups beyond keep_count
        let to_delete = &backups[keep_count..];
        for backup in to_delete {
            let _ = delete_backup(&backup.filename);
        }
    }

    Ok(())
}

/// Get the size of a backup file
pub fn get_backup_size(filename: &str) -> Result<u64, Box<dyn std::error::Error>> {
    if !filename.starts_with("payme_") || !filename.ends_with(".db") {
        return Err("Invalid backup filename".into());
    }

    let backups_dir = get_backups_dir();
    let path = backups_dir.join(filename);

    let metadata = fs::metadata(path)?;
    Ok(metadata.len())
}

/// Format bytes to human-readable size
pub fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;

    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }

    if unit_idx == 0 {
        format!("{} {}", size as u64, UNITS[unit_idx])
    } else {
        format!("{:.2} {}", size, UNITS[unit_idx])
    }
}
