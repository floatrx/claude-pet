use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub status: String,
    pub tool: Option<String>,
    pub since: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetState {
    pub sessions: Vec<Session>,
}

pub fn state_file_path() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");
    home.join(".claude").join("pet-state.json")
}

pub fn read_state(path: &PathBuf) -> Option<PetState> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}
