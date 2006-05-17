
import time

from zope.app.publisher.browser import BrowserView
from zope.app.session.interfaces import ISession

from cpsskins import minjson as json

RIGHT_ANSWERS = ('blue', 'red', 'yellow')

class Views(BrowserView):

    def __init__(self, context, request):
        self.context = context
        self.request = request
        self.session = ISession(self.request)['cpsskins']

    def getAnswer(self):
        # sleep one second to simulate a delay
        time.sleep(1)

        # get the data from the session
        data = self.session.get('data1', {u'content': u'No data available.'})

        # return the data
        return json.write(data)

    def setAnswer(self, data):
        # sleep 2 seconds to simulate a delay
        time.sleep(2)

        # get the data
        data = json.read(data)

        # validate the data
        content = data['content']
        if content in RIGHT_ANSWERS:
           comment = u'Right answer!'
        else:
           comment = u'WRONG answer :-('

        # write a message
        data['message'] = "You answered '%s': %s" % (content, comment)

        # store the data in the session
        self.session['data1'] = data

        # return the results
        return json.write(data)

