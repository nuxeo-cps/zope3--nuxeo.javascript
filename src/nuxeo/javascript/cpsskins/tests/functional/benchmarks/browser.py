
import time

from zope.app.publisher.browser import BrowserView

from cpsskins import minjson as json

class Views(BrowserView):

    def getData1(self):
        return json.write(data)

    def setData1(self, data):
        data = json.read(data)

        return json.write(data)

