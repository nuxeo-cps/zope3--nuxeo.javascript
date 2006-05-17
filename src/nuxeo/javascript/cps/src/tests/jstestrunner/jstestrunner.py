from httpserver import JsThreadServer
import os
import subprocess
import time
import signal
import urllib

class JsTestRunner(object):

    def __init__(self, path, browsercommand='mozilla-firefox'):
        self.http_server = None
        self.path = path
        self.port = 8081
        self.browsercommand = browsercommand

    def _startHttpServer(self):
        if self.http_server is not None:
            return None
        # starting the http server
        self.http_server = JsThreadServer(self.port)
        self.http_server.start()

    def _stopHttpServer(self):
        if self.http_server is None:
            return None

        # waiting for the http server
        self.http_server.join()

    def runTests(self):
        self._startHttpServer()
        tests = self._collectTests(self.path)
        # running tests
        results = []
        try:
            for test in tests:
                results.append(self._launchTest(test))
            return results
        finally:
            self._stopHttpServer()

    def _launchTest(self, test):
        # calling the browser
        cmd = '%s %s' % (self.browsercommand, test)
        p = subprocess.Popen(cmd, shell=True)
        time.sleep(1)

        while self.http_server.results() == []:
            time.sleep(0.5)
        results = self.http_server.results()[0]
        self.http_server.purgeResults()
        os.system('kill -9 %d' % p.pid)
        #sts = os.kill(p.pid, signal.SIGKILL)
        #import pdb; pdb.set_trace()
        return self._transformsResults(results)

    def _collectTests(self, path):
        def _isTest(file):
            return file.endswith('.html') and file.startswith('test')

        return [os.path.join(path, file) for file in os.listdir(path)
                if _isTest(file)]

    def _transformsResults(self, results):
        results = urllib.unquote(results)
        def _unBR(message):
            def _unList(element):
                if len(element) == 1:
                    return element[0]
                else:
                    return element
            return [_unList(element.split('<br/>')) for element in message]
        return [_unBR(element.split('::')) for element in results.split(':::')]
