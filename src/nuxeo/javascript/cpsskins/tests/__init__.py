
from zope.publisher.interfaces.browser import IDefaultBrowserLayer
from zope.publisher.interfaces.browser import IBrowserRequest

class cpsskinsTest(IBrowserRequest):
    """The test layer"""

class ITestSkin(cpsskinsTest, IDefaultBrowserLayer):
    """The test skin"""
