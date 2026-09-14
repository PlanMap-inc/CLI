class Calculator:
    def add(self, a, b):
        return a + b

    @classmethod
    def create(cls, a):
        return cls(a)

    def configure(self, a, /, b, *, c):
        return a + b + c


class FeatureFlag:
    if True:
        def enabled_method(self, x):
            return x
