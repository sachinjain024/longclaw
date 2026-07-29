pub mod error;
pub mod index;
pub mod model;
pub mod storage;

pub use error::{AppError, AppResult, ErrorCode};
pub use index::TicketIndex;
pub use model::*;
