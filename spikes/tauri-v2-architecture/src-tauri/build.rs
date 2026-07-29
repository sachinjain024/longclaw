fn main() {
    // Tauri's generated context requires a PNG even when bundling is disabled.
    // The architecture spike has no production artwork, so generate a valid
    // transparent placeholder rather than committing a misleading app icon.
    let icon_path = std::path::Path::new("icons/icon.png");
    std::fs::create_dir_all("icons").expect("create generated icon directory");
    std::fs::write(
        icon_path,
        [
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
            8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 29, 99, 248, 207, 192,
            240, 31, 0, 5, 128, 2, 63, 73, 194, 251, 89, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96,
            130,
        ],
    )
    .expect("write generated placeholder icon");
    tauri_build::build()
}
