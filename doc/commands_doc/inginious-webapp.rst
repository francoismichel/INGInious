inginious-webapp
================

Starts the Web App Frontend. This command can run a standalone web server (see ``--host`` and ``--port`` options),
but also as a FastCGI backend.

.. program:: inginious-webapp

::

    inginious-webapp [-h] [--config CONFIG] [--host HOST] [--port PORT] [--sshhost SSHHOST] [--sshport SSHPORT]

.. option:: --config

   Specify the configuration file to use. By default, it is configuration.yaml or configuration.json, depending on which is found first.

.. option:: --host HOST

   Specify the host to which to bind to. By default, it is localhost.

.. option:: --port PORT

   Specify the port to which to bind to. By default, it is 8080.

.. option:: --sshhost SSHHOST

   Specify the host to which the remote debug manager will bind. If it is not set, remote debugging will be deactivated.

.. option:: --sshport SSHPORT

   Specify the port to which the remote debug manager will bind.

.. option:: -h, --help

   Display the help message.