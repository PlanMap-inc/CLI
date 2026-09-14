class Api:
    @property
    def value(self):
        return self._value

    @staticmethod
    def helper(x):
        return x

    @app.route("/x")
    def route_handler(self):
        return "ok"
