fn main() {
    // Tauri's generated context requires a PNG even when bundling is disabled.
    // Production artwork is not part of the local-core foundation yet. Generate
    // a valid transparent placeholder rather than committing a misleading icon.
    let icon_path = std::path::Path::new("icons/icon.png");
    std::fs::create_dir_all("icons").expect("create generated icon directory");
    std::fs::write(
        icon_path,
        [
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 32, 0, 0, 0, 32,
            8, 6, 0, 0, 0, 115, 122, 122, 244, 0, 0, 0, 26, 73, 68, 65, 84, 120, 218, 237, 193, 1,
            1, 0, 0, 0, 130, 32, 255, 175, 110, 72, 64, 1, 0, 0, 0, 239, 6, 16, 32, 0, 1, 201, 181,
            195, 177, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
        ],
    )
    .expect("write generated placeholder icon");
    tauri_build::build()
}
