
from urllib import unquote

from zope.app.publisher.browser import BrowserView

from cpsskins import minjson as json

tree_data = {
    'items': [
        {'id': '1', 'title': 'item 1', 'depth': 1, 'type': 'inner'},
        {'id': '2', 'title': 'item 2', 'depth': 2, 'type': 'inner',
         'empty': True},
        {'id': '3', 'title': 'item 3', 'depth': 2, 'type': 'leaf'},
        {'id': '4', 'title': 'item 4', 'depth': 2, 'type': 'inner'},
        {'id': '5', 'title': 'item 5', 'depth': 3, 'type': 'leaf', 
          'position': 'last'},
        {'id': '6', 'title': 'item 6', 'depth': 1, 'type': 'inner'},
        {'id': '7', 'title': 'item 7', 'depth': 2, 'type': 'inner',
         'empty': True},
        {'id': '8', 'title': 'item 8', 'depth': 2, 'type': 'leaf',
          'position': 'last'},
    ]
}

MAX_DEPTH = 10

class Views(BrowserView):

    def getTreeData(self):
        local_data = self._getLocalStorageData(1)
        if local_data is None:
            local_data = {}
        tree_state = local_data.get('state', {})

        filtered_items = []
        filter_depth = MAX_DEPTH
        for item in tree_data['items']:

            depth = item['depth']
            if depth > filter_depth:
                continue
            else:
                filter_depth = MAX_DEPTH

            if item['type'] == 'inner':
                state = tree_state.get(item['id'])
                if state != 'open':
                    filter_depth = depth

            filtered_items.append(item)
        self.request.response.setHeader('content-type', 'text/x-json')
        return json.write({'items': filtered_items})

    def setTreeData(self, data):
        return self.getTreeData()

    # TODO: moves this to an API
    def _getLocalStorageData(self, id):
        value = self.request.cookies.get('cpsskins_local_storage_%s' % id)
        if value is not None:
            return json.read(unquote(value))
        return None
