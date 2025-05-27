use vrs_core_sdk::codec::{Decode, Encode};
use vrs_core_sdk::export;

#[derive(Debug, Decode, Encode)]
#[export]
pub struct Q {
    pub a: u32,
    pub b: u32,
}
