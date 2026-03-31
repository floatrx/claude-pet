use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub status: String,
    pub tool: Option<String>,
    pub tool_detail: Option<String>,
    pub model: Option<String>,
    pub project: Option<String>,
    pub needs_attention: Option<bool>,
    pub since: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subagent {
    pub id: String,
    pub parent_id: String,
    #[serde(rename = "type")]
    pub agent_type: String,
    pub status: String,
    pub since: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetState {
    pub sessions: Vec<Session>,
    #[serde(default)]
    pub subagents: Vec<Subagent>,
}

pub fn state_file_path() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");
    home.join(".claude").join("pet-state.json")
}

pub fn read_state(path: &PathBuf) -> Option<PetState> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}
