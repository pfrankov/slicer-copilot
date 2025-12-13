export class FileFormatError extends Error {
  /**
   * @param {{ path: string, message?: string }} options
   */
  constructor({ path, message }) {
    super(message ?? `Invalid JSON format in ${path}`);
    this.name = "FileFormatError";
    this.path = path;
  }
}
