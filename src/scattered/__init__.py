import pathlib
from urllib.parse import urlparse
import anywidget
import traitlets
import numpy as np
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
    # Indices of points selected via lasso (synced from JS)
    selected_indices = traitlets.List(traitlets.Int()).tag(sync=True)

    def __init__(self, input, encoding=None, options=None):
        """
        Entry point.

        Args:
            input: Input data which can be of the following types:
                - str: A URL to read the data from.
                - pd.DataFrame: A pandas DataFrame.
                - np.ndarray: A 2D array of shape (N, 3) with x, y, z coordinates.
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
        elif isinstance(input, np.ndarray):
            if input.ndim != 2 or input.shape[1] != 3:
                raise ValueError(f"Expected a 2D numpy array with 3 columns (x, y, z), got shape {input.shape}.")
            df = pd.DataFrame(input, columns=["x", "y", "z"])
            input_as_arrow_bytes = _dataframe_to_arrow_bytes(df)
        elif isinstance(input, bytes):
            input_as_arrow_bytes = input # expecting that bytes are already in Arrow format
        else:
            raise ValueError("Unsupported input type. Supported types are: str (URL), pd.DataFrame, np.ndarray, bytes (Arrow format).")

        super().__init__(input_table=input_as_arrow_bytes, encoding=encoding or {})

    def selected_to_numpy(self):
        """Return the selected points as a numpy array of shape (N, 3).

        Returns:
            numpy.ndarray: Array of x, y, z coordinates for selected points.
        """
        if not self.selected_indices:
            return np.empty((0, 3))

        reader = pa.ipc.open_stream(self.input_table)
        table = reader.read_all()
        subset = table.take(self.selected_indices)

        enc = self.encoding or {}
        x_col = enc.get("x", "x")
        y_col = enc.get("y", "y")
        z_col = enc.get("z", "z")
        return np.column_stack([
            subset.column(x_col).to_numpy(),
            subset.column(y_col).to_numpy(),
            subset.column(z_col).to_numpy(),
        ])

    def selected_to_dataframe(self):
        """Return the selected points as a pandas DataFrame with all columns.

        Returns:
            pandas.DataFrame: Subset of the input data for selected points.
        """
        if not self.selected_indices:
            return pd.DataFrame()

        reader = pa.ipc.open_stream(self.input_table)
        table = reader.read_all()
        subset = table.take(self.selected_indices)
        return subset.to_pandas()
