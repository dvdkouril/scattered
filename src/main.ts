import { fetchRemoteData } from "./loaders";

function display(url: string) {
  const data = fetchRemoteData(url);
}


export { display };
