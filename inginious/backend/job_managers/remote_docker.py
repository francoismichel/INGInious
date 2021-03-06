# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" A Job Manager that automatically launch Agents on distant Docker daemons """
import logging

import docker
import docker.utils

from inginious.backend.job_managers.remote_manual_agent import RemoteManualAgentJobManager

AGENT_CONTAINER_VERSION = "0.5"


class RemoteDockerJobManager(RemoteManualAgentJobManager):
    """ A Job Manager that automatically launch Agents on distant Docker daemons """

    @classmethod
    def is_agent_valid_and_started(cls, docker_connection, agent_name):
        logger = logging.getLogger("inginious.backend")
        try:
            container_data = docker_connection.inspect_container(agent_name)
        except:
            logger.info("No agent present on remote host.")
            return False

        # Due to a bug in Docker 1.9, labels are not returned for running containers
        # if container_data["Config"]["Labels"] is None or "agent-version" not in container_data["Config"]["Labels"] or container_data["Config"][
        #    "Labels"]["agent-version"] != AGENT_CONTAINER_VERSION:
        # Workaround:
        if cls.is_agent_image_update_needed(docker_connection):
            logger.info("Agent already started, but not at the right version.")
            try:
                # kill the container
                docker_connection.kill(agent_name)
                docker_connection.remove_container(agent_name, force=True)
            except:
                pass
            return False
        elif container_data["State"]["Running"] is False:
            logger.info("Agent dead.")
            try:
                # remove the container and restart it
                docker_connection.remove_container(agent_name, force=True)
            except:
                pass
            return False
        else:
            return True

    @classmethod
    def is_agent_image_update_needed(cls, docker_connection):
        try:
            image_data = docker_connection.inspect_image("ingi/inginious-agent")
            if image_data["Config"]["Labels"]["agent-version"] != AGENT_CONTAINER_VERSION:
                return True
        except:
            return True
        return False

    def __init__(self, docker_daemons, image_aliases, task_directory, course_factory, task_factory, hook_manager=None, is_testing=False):
        """
            Starts the job manager.

            :param docker_daemons:
                a list of dict representing docker daemons.

                { "remote_host": "192.168.59.103" ## host of the docker daemon *from the webapp*
                  "remote_docker_port": 2375      ## port of the distant docker daemon *from the webapp*
                  "remote_agent_port": 63456      ## a mandatory port used by the inginious.backend and the agent that will be automatically started.
                                                  ## Needs to be available on the remote host, and to be open in the firewall.

                  ## Optionnal. Enable remote container debugging via SSH.
                  ## The port needs to be available on the remote host, and to be open in the firewall.
                  #"remote_agent_ssh_port": 63457,

                  ##does the docker daemon requires tls? Defaults to false
                  ##parameter can be set to true or path to the certificates
                  #use_tls: false

                  ##link to the docker daemon *from the host that runs the docker daemon*. Defaults to:
                  #"local_location": "unix:///var/run/docker.sock"

                  ##path to the cgroups "mount" *from the host that runs the docker daemon*. Defaults to:
                  #"cgroups_location": "/sys/fs/cgroup"

                  ##name that will be used to reference the agent
                  #"agent_name": "inginious-agent"
                }
            :param task_directory: the task directory
            :param course_factory: a CourseFactory object
            :param task_factory: a TaskFactory object, possibly with specific task files managers attached
            :param image_aliases: a dict of image aliases, like {"default": "ingi/inginious-c-default"}.
            :param hook_manager: An instance of HookManager. If no instance is given(None), a new one will be created.
        """
        agents = []
        self._logger = logging.getLogger("inginious.backend")

        for daemon in docker_daemons:
            if daemon.get("use_tls", False):
                if isinstance(daemon["use_tls"], basestring):
                    tls_config = docker.tls.TLSConfig(
                        client_cert=(daemon["use_tls"] + '/cert.pem', daemon["use_tls"] + '/key.pem'),
                        verify=daemon["use_tls"] + '/ca.pem'
                    )
                elif isinstance(daemon["use_tls"], dict):
                    tls_config = docker.tls.TLSConfig(
                        client_cert=(daemon["use_tls"]["cert"], daemon["use_tls"]["key"]),
                        verify=daemon["use_tls"]["ca"]
                    )
                else:
                    tls_config = True
                docker_connection = docker.Client(base_url="https://" + daemon['remote_host'] + ":" + str(int(daemon["remote_docker_port"])),
                                                  tls=tls_config)
            else:
                docker_connection = docker.Client(base_url="http://" + daemon['remote_host'] + ":" + str(int(daemon["remote_docker_port"])),
                                                  tls=False)

            agent_name = daemon.get('agent_name', 'inginious-agent')

            # Verify if the container is available and at the right version
            if not self.is_agent_valid_and_started(docker_connection, agent_name):

                # Verify that the image ingi/inginious-agent exists and is up-to-date
                if self.is_agent_image_update_needed(docker_connection):
                    self._logger.info("Pulling the image ingi/inginious-agent. Please wait, this can take some time...")
                    for line in docker_connection.pull("ingi/inginious-agent", stream=True):
                        self._logger.info(line)
                    self._logger.info("Pulling the image centos. Please wait, this can take some time...")
                    for line in docker_connection.pull("centos", stream=True):
                        self._logger.info(line)

                    # Verify again that the image is ok
                    if self.is_agent_image_update_needed(docker_connection):
                        raise Exception("The downloaded image ingi/inginious-agent is not at the same version as this instance of INGInious. " \
                                        "Please update  INGInious or pull manually a valid version of the container image ingi/inginious-agent.")

                docker_local_location = daemon.get("local_location", "unix:///var/run/docker.sock")
                environment = {"AGENT_CONTAINER_NAME": agent_name,
                               "AGENT_PORT": daemon.get("remote_agent_port", 63456),
                               "AGENT_SSH_PORT": daemon.get("remote_agent_ssh_port", "")}
                volumes = {'/sys/fs/cgroup/': {}}
                binds = {daemon.get('cgroups_location', "/sys/fs/cgroup"): {'ro': False, 'bind': "/sys/fs/cgroup"}}

                if docker_local_location.startswith("unix://"):
                    volumes['/var/run/docker.sock'] = {}
                    binds[docker_local_location[7:]] = {'ro': False, 'bind': '/var/run/docker.sock'}
                    environment["DOCKER_HOST"] = "unix:///var/run/docker.sock"
                elif docker_local_location.startswith("tcp://"):
                    environment["DOCKER_HOST"] = docker_local_location
                    if daemon.get("use_tls", False):
                        environment["DOCKER_TLS_VERIFY"] = "on"
                else:
                    raise Exception("Unknown protocol for local docker daemon: " + docker_local_location)

                response = docker_connection.create_container(
                    "ingi/inginious-agent",
                    environment=environment,
                    detach=True,
                    name=agent_name,
                    volumes=volumes
                )
                container_id = response["Id"]

                # Start the container
                docker_connection.start(container_id, network_mode="host", binds=binds, restart_policy={"Name": "always"})

            agents.append({"host": daemon['remote_host'],
                           "port": daemon.get("remote_agent_port", 63456),
                           "ssh_port": daemon.get("remote_agent_ssh_port")})

        RemoteManualAgentJobManager.__init__(self, agents, image_aliases, task_directory, course_factory, task_factory, hook_manager, is_testing)
