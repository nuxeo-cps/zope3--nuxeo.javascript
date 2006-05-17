
from zope.app.publisher.browser import BrowserView

from cpsskins import minjson as json

class FormAction(BrowserView):

    def doSomething(self):
        self.request.response.setHeader('content-type', 'text/x-json')
        return json.write({'form': {'updated': 1}})
