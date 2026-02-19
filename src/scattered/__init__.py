import pathlib
from urllib.parse import urlparse
import anywidget
import traitlets
import pandas as pd
import pyarrow as pa
import requests

def _fetch_remote_table(url):
    """Fetch Arrow table from remote URL and return as bytes.

    Args:
        url: URL to fetch the Arrow data from.

    Returns:
        bytes: Arrow table serialized as bytes.
    """
    response = requests.get(url)
    response.raise_for_status()
    return response.content


def _dataframe_to_arrow_bytes(df):
    """Convert pandas DataFrame to Arrow bytes.

    Args:
        df: pandas DataFrame to convert.

    Returns:
        bytes: Arrow table serialized as bytes.
    """
    table = pa.Table.from_pandas(df)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return sink.getvalue().to_pybytes()


class Widget(anywidget.AnyWidget):
    _esm = pathlib.Path(__file__).parent / "widget.js"

    # Apache Arrow Table serialized as bytes
    input_table = traitlets.Bytes().tag(sync=True)
    # Encoding (specifying which columns of the data map to what attributes)
    encoding = traitlets.Dict().tag(sync=True)
    # Options for the visualization (e.g., background color)
    options = traitlets.Dict().tag(sync=True)

    def __init__(self, input, encoding=None, options=None):
        """
        Entry point.

        Args:
            input: Input data which can be of the following types:
                - str: A URL to read the data from.
                - pd.DataFrame: A pandas DataFrame.
                - bytes: Arrow IPC bytes.
            encoding: (Optional) Dict mapping visual channels to column names,
                e.g. {"color": "letter"}.
            options: (Optional) Additional options for widget configuration.
        """
        input_as_arrow_bytes = None
        if isinstance(input, str):
            parsed = urlparse(input)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                raise ValueError(f"Invalid URL: {input!r}. Must be a valid http or https URL.")
            input_as_arrow_bytes = _fetch_remote_table(input)
        elif isinstance(input, pd.DataFrame):
            input_as_arrow_bytes = _dataframe_to_arrow_bytes(input)
        elif isinstance(input, bytes):
            input_as_arrow_bytes = input # expecting that bytes are already in Arrow format
        else:
            raise ValueError("Unsupported input type. Supported types are: str (URL), pd.DataFrame, bytes (Arrow format).")

        super().__init__(input_table=input_as_arrow_bytes, encoding=encoding or {})
