
import random
import time

from zope.app.publisher.browser import BrowserView
from zope.app.cache.ram import RAMCache

from cpsskins import minjson as json

cache = RAMCache()

class Views(BrowserView):

    def setDataWithLatency(self, data):
        data = json.read(data)

        # this only simulates latency on the server.
        # network latency can be simulated with the AJAX Proxy tool
        # (https://sourceforge.net/projects/jpspan/)
        latency = data.get('latency')
        if latency:
            time.sleep(random.randint(1, latency))

        storage = data['storage']
        cache.set(data, storage, {})
        self.request.response.setHeader('content-type', 'text/x-json')
        return json.write(data)

