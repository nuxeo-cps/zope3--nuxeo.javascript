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
"""nuxeo.lucene

$Id$
"""
import os
import sys

# this allows the nuxeo.javascript package to be installed as a Zope product.
# It will add the src directory to the PYTHONPATH.
# Note that this strictly optional, just makes deployment with
# Zope more easy.
product_dir, filename = os.path.split(__file__)
src_path = os.path.join(product_dir, 'src')
sys.path.insert(0, src_path)

def initialize(context):
    pass
