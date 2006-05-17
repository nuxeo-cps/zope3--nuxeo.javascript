import os
from jstestrunner import JsTestRunner

dirname = os.path.dirname(__file__)

if dirname == '':
    dirname = '.'

testrunner = JsTestRunner(dirname)
results = testrunner.runTests()

# now we need to interpret and simulate results
# xxxx
print results