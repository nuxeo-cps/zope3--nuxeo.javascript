#!/usr/bin/env python
##############################################################################
#
# Copyright (c) 2006 Nuxeo SAS <http://nuxeo.com>
# All Rights Reserved.
#
# Author : Julien Anguenot <ja@nuxeo.com>
#
# This software is subject to the provisions of the Zope Public License,
# Version 2.0 (ZPL).  A copy of the ZPL should accompany this distribution.
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
# WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
# FOR A PARTICULAR PURPOSE.
#
##############################################################################
"""nuxeo.lucene test runner

$Id$
"""

import os, sys

src = os.path.join(os.path.split(sys.argv[0])[0], 'src')
# Assumes Zope-3.2 within /opt/Zope-3.2
sys.path.insert(0, '/opt/Zope-3.2/lib/python')
sys.path.insert(0, src) # put at beginning to avoid one in site_packages

from zope.testing import testrunner

defaults = [
    '--path', src,
    '--tests-pattern', '^tests$',
    ]

sys.exit(testrunner.run(defaults))
