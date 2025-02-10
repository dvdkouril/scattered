export async function loadDataFromURL(url: string): Promise<ArrayBuffer | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    //return load(buffer, options);
    return buffer;
  } catch (err) {
    let message = "Unknown Error";
    if (err instanceof Error) message = err.message;
    console.error(message);
    return undefined;
  }
}
