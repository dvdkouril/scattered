import pathlib
import anywidget
import traitlets

class Widget(anywidget.AnyWidget):
    _esm = pathlib.Path(__file__).parent / "widget.js"

    # Apache Arrow Table serialized as bytes
    input_table = traitlets.Bytes().tag(sync=True)
    # Options for the visualization (e.g., background color)
    options = traitlets.Dict().tag(sync=True)

    def __init__(self, input, options=None):
        """
        Entry point.

        Args:
            input: Input data which can be of the following types:
                - str: A URL to read the data from.
            options: (Optional) Additional options for widget configuration.
        """
        input_as_arrow_bytes = None
        if isinstance(input, str):
            # TODO: check if input is a valid URL
            input_as_arrow_bytes = fetch_remote_table(input)
        elif isinstance(input, pd.DataFrame):
            input_as_arrow_bytes = dataframe_to_arrow_bytes(input)
        elif isinstance(input, bytes):
            input_as_arrow_bytes = input # expecting that bytes are already in Arrow format
        else:
            raise ValueError("Unsupported input type. Supported types are: str (URL), pd.DataFrame, bytes (Arrow format).")

        super().__init__(input_table=input_as_arrow_bytes)
