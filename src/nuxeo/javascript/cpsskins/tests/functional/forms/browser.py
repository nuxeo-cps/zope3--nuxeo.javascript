
import re
import time

from zope.app.publisher.browser import BrowserView
from zope.app.cache.ram import RAMCache

from zope.interface import Interface, implements
from zope.schema import Text, Choice, Int
from zope.schema.interfaces import RequiredMissing, ConstraintNotSatisfied
from zope.schema.fieldproperty import FieldProperty

from cpsskins import minjson as json

cache = RAMCache()

class DummySchema(Interface):

    firstname = Text(
        title=u'First name',
        description=u'Your name',
        required=True,
        )

    lastname = Text(
        title=u'Last name',
        description=u'Your surname',
        required=True,
        )

    email = Text(
        title=u'Email address',
        description=u'Your email address',
        default=u'email@your.domain.org',
        constraint = re.compile(
                   "^([0-9a-z_&.+-]+!)*[0-9a-z_&.+-]+"
                   "@(([0-9a-z]([0-9a-z-]*[0-9a-z])?\.)+"
                   "[a-z]{2,3}|([0-9]{1,3}\.){3}[0-9]{1,3})$").match,
        required=False,
        )

    gender = Choice(
        title=u'Gender',
        values=(u'Male', u'Female'),
        )

    id = Int(
        title=u'Identifier',
        default=100,
        readonly=True,
        )

# TODO: move this to the view definition
form_layout = ['firstname', 'lastname', 'email', 'gender', 'id']

class Views(BrowserView):

    def __init__(self, context, request):
        self.context = context
        self.request = request

        self.schema = DummySchema # for testing

        self.initial_form_data = self._initializeFormData()

    def _initializeFormData(self):

        fields = []
        for name in form_layout:
            field_def = FieldProperty(self.schema[name])
            field_info = {
                'name': name,
                'label': field_def.title,
                'hint': field_def.description,
                'value': field_def.default,
                'disabled': field_def.readonly,
                'status': u'',
            }

            choices = getattr(field_def, 'vocabulary', None)
            #if choices:
               #print list(choices)
               #field_info['values'] = choices()

            fields.append(field_info)

        return {'fields': fields}

    def getFormData(self):
        data = cache.query('formdata', {}, self.initial_form_data)
        return json.write(data)

    def setFormData(self, data):
        data = json.read(data)

        form_data = cache.query('formdata', {}, self.initial_form_data)
        fields = form_data['fields'][:]

        for field in fields:
            name = field['name']
            value = data[name]
            schema_field = self.schema[name]

            # validation
            field['status'] = u''
            try:
                value = schema_field.fromUnicode(value)
            except (ValueError, ConstraintNotSatisfied):
                field['status'] = u"Incorrect value"
            except RequiredMissing:
                field['status'] = u"this field is required"

            field['value'] = value

        form_data = {'fields': fields}
        print form_data

        cache.set(form_data, 'formdata', {})
        return json.write(form_data)

