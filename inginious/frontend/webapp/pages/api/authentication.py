# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Authentication """

import web

from inginious.frontend.webapp.pages.api._api_page import APIPage, APIInvalidArguments


class APIAuthentication(APIPage):
    """
        Endpoint /api/v0/authentication
    """

    def API_GET(self):
        """
            Returns {"authenticated": false} or {"authenticated": true, "username": "your_username"} (always 200 OK)
        """
        if self.user_manager.session_logged_in():
            return 200, {"authenticated": True, "username": self.user_manager.session_username()}
        else:
            return 200, {"authenticated": False}

    def API_POST(self):
        """
            Authenticates the remote client. Takes as input:

            auth_method_id
                an id for an auth method as returned be /api/v0/auth_methods

            input_key_1
                the first input key and its value

            input_key_2
                the first input key and its value

            ...
                ...

            Response: a dict in the form {"status": "success"} (200 OK) or {"status": "error"} (403 Forbidden)
        """

        user_input = web.input()
        if not "auth_method_id" in user_input:
            raise APIInvalidArguments()

        try:
            auth_method_id = int(user_input["auth_method_id"])
        except:
            raise APIInvalidArguments()

        del user_input["auth_method_id"]

        try:
            if self.user_manager.auth_user(int(auth_method_id), dict(user_input)):
                return 200, {"status": "success", "username": self.user_manager.session_username()}
        except:
            pass
        return 403, {"status": "error"}
