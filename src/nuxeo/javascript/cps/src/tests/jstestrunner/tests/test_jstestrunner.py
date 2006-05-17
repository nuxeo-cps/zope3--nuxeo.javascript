#!/usr/bin/python
# -*- encoding: iso-8859-15 -*-
# (C) Copyright 2006 Nuxeo SARL <http://nuxeo.com>
# Author: Tarek Ziadé <tz@nuxeo.com>
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 2 as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#"
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
# 02111-1307, USA.
#
import unittest
import doctest
import os
import sys

current_dir = os.path.dirname(__file__)
if current_dir == '':
    current_dir = '.'
    topdir = '..'
else:
    topdir = os.path.split(current_dir)

if topdir not in sys.path:
    sys.path.append(topdir)

datadir = os.path.join(current_dir, 'data')

from jstestrunner import JsTestRunner


class TestJSTestRunner(unittest.TestCase):

    def test_collectTests(self):
        runner = JsTestRunner(datadir)
        tests = runner._collectTests(datadir)
        self.assertEquals(tests, ['./data/test_CPSEvents.html'])

    def test_collectTests2(self):
        runner = JsTestRunner('')
        tests = runner._collectTests(datadir)
        self.assertEquals(tests, ['./data/test_CPSEvents.html'])

    def test_parser(self):
        raw = ('passed::1%20assertions,%200%20failures,%200%20errors:::'
               'failed::2%20assertions,%201%20failures,%200%20errors::Fai'
               'lure:%20assertEqual:%20expected%20%22not%22,%20actual%2'
               '0%22ot%22:::passed::1%20assertions,%200%20failures,%200'
               '%20errors')

        runner = JsTestRunner('')
        result = runner._transformsResults(raw)

        wanted = [['passed', '1 assertions, 0 failures, 0 errors'],
                  ['failed', '2 assertions, 1 failures, 0 errors',
                   'Failure: assertEqual: expected "not", actual "ot"'],
                  ['passed', '1 assertions, 0 failures, 0 errors']]

        self.assertEquals(result, wanted)

def test_suite():
    suites = [unittest.makeSuite(TestJSTestRunner)]
    return unittest.TestSuite(suites)

if __name__=="__main__":
    unittest.main(defaultTest='test_suite')
