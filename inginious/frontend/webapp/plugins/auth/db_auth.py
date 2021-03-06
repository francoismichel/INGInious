# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" Database auth """

import hashlib
import random
import re

import web

from inginious.frontend.webapp.user_manager import AuthMethod
from inginious.frontend.webapp.pages.utils import INGIniousPage


class DatabaseAuthMethod(AuthMethod):
    """
    MongoDB Database auth method
    """

    def __init__(self, name, database):
        self._name = name
        self._database = database

    def get_name(self):
        return self._name

    def auth(self, login_data):
        username = login_data["login"]
        password_hash = hashlib.sha512(login_data["password"]).hexdigest()

        user = self._database.users.find_one({"username": username, "password": password_hash, "activate": {"$exists": False}})

        if user is not None:
            return username, user["realname"], user["email"]
        else:
            return None

    def needed_fields(self):
        return {"input": {"login": {"type": "text", "placeholder": "Login"}, "password": {"type": "password", "placeholder": "Password"}},
                "info": """<div class="text-center"><a href="/register">Register</a> / <a href="/register#lostpasswd">Lost password ?</a></div>"""}

    def should_cache(self):
        return False

    def get_users_info(self, usernames):
        """
        :param usernames: a list of usernames
        :return: a dict containing key/pairs {username: (realname, email)} if the user is available with this auth method,
            {username: None} else
        """
        retval = {username: None for username in usernames}
        data = self._database.users.find({"username": {"$in": usernames}})
        for user in data:
            retval[user["username"]] = (user["realname"], user["email"])
        return retval


class RegistrationPage(INGIniousPage):
    """ Registration page for DB authentication """

    def GET(self):
        error = False
        reset = None
        msg = ""
        data = web.input()

        if "activate" in data:
            user = self.database.users.find_one_and_update({"activate": data["activate"]}, {"$unset": {"activate": True}})
            if user is None:
                error = True
                msg = "Invalid activation hash."
            else:
                msg = "You are now activated. You can proceed to login."
        elif "reset" in data:
            user = self.database.users.find_one({"reset": data["reset"]})
            if user is None:
                error = True
                msg = "Invalid reset hash."
            else:
                reset = {"hash": data["reset"], "username": user["username"], "realname": user["realname"]}

        return self.template_helper.get_custom_template_renderer('frontend/webapp/templates', 'layout').register(reset, msg, error)

    def register_user(self, data):
        """ Parses input and register user """
        error = False
        msg = ""

        email_re = re.compile(
            r"(^[-!#$%&'*+/=?^_`{}|~0-9A-Z]+(\.[-!#$%&'*+/=?^_`{}|~0-9A-Z]+)*"  # dot-atom
            r'|^"([\001-\010\013\014\016-\037!#-\[\]-\177]|\\[\001-011\013\014\016-\177])*"'  # quoted-string
            r')@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?$', re.IGNORECASE)  # domain

        # Check input format
        if re.match("\w{4,}$", data["username"]) is None:
            error = True
            msg = "Invalid username format."
        elif email_re.match(data["email"]) is None:
            error = True
            msg = "Invalid email format."
        elif len(data["passwd"]) < 6:
            error = True
            msg = "Password too short."
        elif data["passwd"] != data["passwd2"]:
            error = True
            msg = "Passwords don't match !"

        if not error:
            existing_user = self.database.users.find_one({"$or": [{"username": data["username"]}, {"email": data["email"]}]})
            if existing_user is not None:
                error = True
                if existing_user["username"] == data["username"]:
                    msg = "This username is already taken !"
                else:
                    msg = "This email address is already in use !"
            else:
                passwd_hash = hashlib.sha512(data["passwd"]).hexdigest()
                activate_hash = hashlib.sha512(str(random.getrandbits(256))).hexdigest()
                self.database.users.insert({"username": data["username"],
                                            "realname": data["realname"],
                                            "email": data["email"],
                                            "password": passwd_hash,
                                            "activate": activate_hash})
                try:
                    web.sendmail(web.config.smtp_sendername, data["email"], "Welcome on INGInious",
                                 """Welcome on INGInious !

To activate your account, please click on the following link :
""" + web.ctx.homedomain + "/register?activate=" + activate_hash)
                    msg = "You are succesfully registered. An email has been sent to you for activation."
                except:
                    error = True
                    msg = "Something went wrong while sending you activation email. Please contact the administrator."

        return msg, error

    def lost_passwd(self, data):
        error = False
        msg = ""

        # Check input format
        email_re = re.compile(
            r"(^[-!#$%&'*+/=?^_`{}|~0-9A-Z]+(\.[-!#$%&'*+/=?^_`{}|~0-9A-Z]+)*"  # dot-atom
            r'|^"([\001-\010\013\014\016-\037!#-\[\]-\177]|\\[\001-011\013\014\016-\177])*"'  # quoted-string
            r')@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?$', re.IGNORECASE)  # domain
        if email_re.match(data["recovery_email"]) is None:
            error = True
            msg = "Invalid email format."

        if not error:
            reset_hash = hashlib.sha512(str(random.getrandbits(256))).hexdigest()
            user = self.database.users.find_one_and_update({"email": data["recovery_email"]}, {"$set": {"reset": reset_hash}})
            if user is None:
                error = True
                msg = "This email address was not found in database."
            else:
                try:
                    web.sendmail(web.config.smtp_sendername, data["recovery_email"], "INGInious password recovery",
                                 "Dear " + user["realname"] + """,

Someone (probably you) asked to reset your INGInious password. If this was you, please click on the following link :
""" + web.ctx.homedomain + "/register?reset=" + reset_hash)
                    msg = "An email has been sent to you to reset your password."
                except:
                    error = True
                    msg = "Something went wrong while sending you reset email. Please contact the administrator."

        return msg, error

    def reset_passwd(self, data):
        error = False
        msg = ""

        # Check input format
        if len(data["passwd"]) < 6:
            error = True
            msg = "Password too short."
        elif data["passwd"] != data["passwd2"]:
            error = True
            msg = "Passwords don't match !"

        if not error:
            passwd_hash = hashlib.sha512(data["passwd"]).hexdigest()
            user = self.database.users.find_one_and_update({"reset": data["reset_hash"]},
                                                           {"$set": {"password": passwd_hash}, "$unset": {"reset": True}})
            if user is None:
                error = True
                msg = "Invalid reset hash."
            else:
                msg = "Your password has been successfully changed."

        return msg, error

    def POST(self):
        """ Handles POST request """
        reset = None
        msg = ""
        error = False
        data = web.input()
        if "register" in data:
            msg, error = self.register_user(data)
        elif "lostpasswd" in data:
            msg, error = self.lost_passwd(data)
        elif "resetpasswd" in data:
            msg, error = self.reset_passwd(data)

        return self.template_helper.get_custom_template_renderer('frontend/webapp/templates', 'layout').register(reset, msg, error)


def init(plugin_manager, _, _2, conf):
    """
        Allow authentication from database
    """

    plugin_manager.register_auth_method(DatabaseAuthMethod(conf.get('name', 'WebApp'), plugin_manager.get_database()))
    plugin_manager.add_page('/register', RegistrationPage)
