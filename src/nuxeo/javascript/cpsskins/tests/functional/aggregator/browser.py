
import time

from zope.app.publisher.browser import BrowserView

from cpsskins import minjson as json

feeds_model_def = """{
    "id": "feed%(id)s",
    "data": {"title": "", "text": "", "updated": ""},
    "storage": {
        "type": "remote",
        "refresh": %(id)s,
        "accessors": {
            "get": "@@getFeed?id=%(id)s"
        }
    }
}
"""

feeds_view_def = """{
    "id": "view%(id)s",
    "widget": {
        "template": "feedbox.html"
    },
    "model": "feed%(id)s",
    "perspectives": ["default"],
    "controllers": ["show-view"]
}
"""

feeds_data = {
    '1': "May you live every day of your life. Jonathan Swift",
    '2': "Only two things are infinite, the universe and human stupidity, "
         "and I'm not sure about the former. Albert Einstein",
    '3': "Nothing endures but change. Heraclitus (540 BC - 480 BC)",
    '4': "Why are our days numbered and not, say, lettered? Woody Allen",
    '5': "Some painters transform the sun into a yellow spot, others transform "
         "a yellow spot into the sun. Pablo Picasso",
    '6': "Fashion is a form of ugliness so intolerable that we have to alter "
         "it every six months. Oscar Wilde",
}

class Views(BrowserView):

    def citeFeedModel(self, id=1):
        return feeds_model_def % {'id': id}

    def citeFeedView(self, id=1):
        return feeds_view_def % {'id': id}

    def getFeed(self, id=1):
        time.sleep(1)
        data = {
          'title': u'Feed #%s' % id,
          'text': feeds_data[id],
          'updated': time.strftime("%a, %d %b %Y %H:%M:%S", time.gmtime())
        }
        self.request.response.setHeader('content-type', 'text/x-json')
        return json.write(data)

