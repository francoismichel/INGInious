# -*- coding: utf-8 -*-
#
# This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
# more information about the licensing of this file.

""" A JobManager that start an agent locally. This is the simplest way to start INGInious, but it only works on Linux machine where the inginious.backend
can access directly to docker and cgroups."""

from inginious.backend.job_managers.abstract import AbstractJobManager
from inginious.backend.agent.local_agent import LocalAgent


class LocalJobManager(AbstractJobManager):
    """ A Job Manager that starts and use a local agent """

    def __init__(self, image_aliases, task_directory, course_factory, task_factory, agent_tmp_dir="./agent_tmp", hook_manager=None, is_testing=False,
                 agent_class=LocalAgent):
        AbstractJobManager.__init__(self, image_aliases, hook_manager, is_testing)
        self._agent = agent_class(image_aliases, task_directory, course_factory, task_factory, agent_tmp_dir)

    def start(self):
        pass

    def _execute_job(self, jobid, task, inputdata, debug):
        self._agent.new_job(jobid, task.get_course_id(), task.get_id(), inputdata, debug,
                            (lambda distant_conn_id, ssh_key: self._handle_ssh_callback(jobid, distant_conn_id, ssh_key)),
                            (lambda result: self._job_ended(jobid, result)))

    def _execute_batch_job(self, jobid, container_name, inputdata):
        self._agent.new_batch_job(jobid, container_name, inputdata, lambda result: self._batch_job_ended(jobid, result))

    def _get_batch_container_metadata_from_agent(self, container_name):
        return self._agent.get_batch_container_metadata(container_name)

    def close(self):
        pass

    def is_remote_debug_active(self):
        return True

    def get_socket_to_debug_ssh(self, job_id):
        remote_conn_id = self._get_distant_conn_id_for_job(job_id)
        if remote_conn_id is not None:
            return self._agent.get_socket_to_debug_ssh(remote_conn_id)

    def kill_job(self, job_id):
        return self._agent.kill_job(job_id)
