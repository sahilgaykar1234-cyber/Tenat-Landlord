const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_WIDTH = 900;
const JPEG_QUALITY = 0.82;

export function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            reject(new Error("Only image files are allowed"));
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            reject(new Error("Image must be smaller than 3 MB"));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
            };
            img.onerror = () => reject(new Error("Could not read image"));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
    });
}
