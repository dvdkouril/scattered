import pathlib
import anywidget

class Widget(anywidget.AnyWidget):
    _esm = pathlib.Path(__file__).parent / "widget.js"

    def __init__(self):
        super().__init__()
