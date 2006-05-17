
import time

from zope.app.publisher.browser import BrowserView
from zope.app.cache.ram import RAMCache

from cpsskins import minjson as json

cache = RAMCache()

MAX_MESSAGES = 6

class Views(BrowserView):

    def getData(self):
        data = cache.query('data', {}, {})
        self.request.response.setHeader('content-type', 'text/x-json')
        return json.write(data)

    def setData(self, data):
        data = json.read(data)

        current_data = cache.query('data', {}, {})
        messages = current_data.get('messages', [])

        input = data.get('input')
        if input:
            user = data.get('user')
            date = time.strftime("%H:%M:%S", time.gmtime())
            if len(messages) > MAX_MESSAGES:
                messages.pop(0)
            messages.append({'text': input, 'user': user, 'date': date});
            del data['input']

        data['status'] = ''
        data['messages'] = messages

        cache.set(data, 'data', {})

        self.request.response.setHeader('content-type', 'text/x-json')
        return json.write(data)

