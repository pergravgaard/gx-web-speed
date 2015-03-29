function Assert() {
	
}

Assert.equals = function(expected, actual, msg) {
	msg = msg || "Expected: '" + expected + "', actual: '" + actual + "'!";
	if (expected == null || actual == null) {
		if (expected === actual) {
			return;
		}
		throw new Error(msg);
	}
	switch (typeof(expected)) {
		case "object":
			if (actual.toString() !== expected.toString()) {
				throw new Error(msg);
			}
			break;
		case "boolean":
		case "string":
			if (actual !== expected) {
				throw new Error(msg);
			}
			break;
	}
}