# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Maintenance page """

from inginious.frontend.webapp.pages.utils import INGIniousPage


class MaintenancePage(INGIniousPage):
    """ Maintenance page """

    def GET(self):
        """ GET request """
        renderer = self.template_helper.get_custom_template_renderer('frontend/templates/')
        return renderer.maintenance()

    def POST(self):
        """ POST request """
        renderer = self.template_helper.get_custom_template_renderer('frontend/templates/')
        return renderer.maintenance()
