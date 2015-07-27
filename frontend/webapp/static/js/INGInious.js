//
// Copyright (c) 2014-2015 Université Catholique de Louvain.
//
// This file is part of INGInious.
//
// INGInious is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// INGInious is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public
// License along with INGInious.  If not, see <http://www.gnu.org/licenses/>.
"use strict";

$(function()
{
    //Init CodeMirror
    colorizeStaticCode();
    $('.code-editor').each(function(index, elem)
    {
        registerCodeEditor(elem, $(elem).attr('data-x-language'), $(elem).attr('data-x-lines'));
    });

    //Init the task form, if we are on the task submission page
    var task_form = $('form#task');
    task_form.on('submit', function()
    {
        submitTask();
        return false;
    });
    if(task_form.attr("data-wait-submission"))
    {
        blurTaskForm();
        resetAlerts();
        displayTaskLoadingAlert();
        waitForSubmission(task_form.attr("data-wait-submission"));
    }
    $('#submissions').find('.submission').on('click', clickOnSubmission);

    //Start affix only if there the height of the sidebar is less than the height of the content
    if($('#sidebar').height() < $('#content').height())
    {
        var start_affix = function()
        {
            $('#sidebar_affix').affix({offset: {top: 65, bottom: 61}});
        };
        var update_size = function()
        {
            $('#sidebar_affix').width($('#sidebar').width());
        };
        $(window).scroll(update_size);
        $(window).resize(update_size);
        update_size();
        start_affix();
    }

    //Registration form, disable the password field when not needed
    var register_courseid = $('#register_courseid');
    if(register_courseid)
    {
        register_courseid.change(function()
        {
            if($('option[value="' + register_courseid.val() + '"]', register_courseid).attr('data-password') == 1)
                $('#register_password').removeAttr('disabled');
            else
                $('#register_password').attr('disabled', 'disabled')
        });
    }

    //Fix a bug with codemirror and bootstrap tabs
    $('a[data-toggle="tab"]').on('shown.bs.tab', function(e)
    {
        var target = $(e.target).attr("href");
        $(target + ' .CodeMirror').each(function(i, el)
        {
            el.CodeMirror.refresh();
        });
    });

    //Enable tooltips
    $(function()
    {
        //Fix for button groups
        var all_needed_tooltips = $('[data-toggle="tooltip"]');
        var all_exceptions = $('.btn-group .btn[data-toggle="tooltip"], td[data-toggle="tooltip"]');

        var not_exceptions = all_needed_tooltips.not(all_exceptions);

        not_exceptions.tooltip();
        all_exceptions.tooltip({'container': 'body'});
    })
});

//Contains all code editors
var codeEditors = [];

//True if loading something
var loadingSomething = false;

//Run CodeMirror on static code
function colorizeStaticCode()
{
    CodeMirror.modeURL = "/static/js/codemirror/mode/%N/%N.js";
    $('.code.literal-block').each(function()
    {
        var classes = $(this).attr('class').split(' ');
        var mode = undefined;
        $.each(classes, function(idx, elem) {
            if(elem != "code" && elem != "literal-block")
            {
                var nmode = CodeMirror.findModeByName(elem);
                if (nmode != undefined)
                    mode = nmode;
            }
        });
        if(mode != undefined)
        {
            var elem = this

            CodeMirror.requireMode(mode['mode'], function()
            {
                CodeMirror.colorize($(elem), mode["mime"]);
            });
        }
    });
}

//Register and init a code editor (ace)
function registerCodeEditor(textarea, lang, lines)
{
    CodeMirror.modeURL = "/static/js/codemirror/mode/%N/%N.js";
    var mode = CodeMirror.findModeByName(lang);
    if(mode == undefined)
        mode = {"mode": "plain", "mime": "text/plain"};

    var is_single = $(textarea).hasClass('single');

    var editor = CodeMirror.fromTextArea(textarea, {
        lineNumbers:       true,
        mode:              mode["mime"],
        foldGutter:        true,
        styleActiveLine:   true,
        matchBrackets:     true,
        autoCloseBrackets: true,
        lineWrapping:      true,
        gutters:           ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        indentUnit:        4,
        viewportMargin:    Infinity,
        lint:              function()
                           {
                               return []
                           }
    });

    if(is_single)
        $(editor.getWrapperElement()).addClass('single');

    editor.on("change", function(cm)
    {
        cm.save();
    });

    var min_editor_height = (21 * lines);
    editor.on("viewportChange", function(cm)
    {
        if(cm.getScrollInfo()["height"] > min_editor_height)
            editor.setSize(null, "auto");
        else
            editor.setSize(null, min_editor_height + "px");
    });
    editor.setSize(null, min_editor_height + "px");

    if(mode["mode"] != "plain")
        CodeMirror.autoLoadMode(editor, mode["mode"]);
    codeEditors.push(editor);
    return editor;
}

//Task page: find an editor by problem id
function getEditorForProblemId(problemId)
{
    var found = null;
    $.each(codeEditors, function(idx, editor)
    {
        if(!found && editor.getTextArea().name == problemId)
            found = editor;
    });
    return found;
}

//Blur task form
function blurTaskForm()
{
    $.each(codeEditors, function(idx, editor)
    {
        editor.setOption("readOnly", true);
    });
    var task_form = $('form#task');
    $("input, button", task_form).attr("disabled", "disabled");
    task_form.addClass('form-blur');
    loadingSomething = true;
}
function unblurTaskForm()
{
    $.each(codeEditors, function(idx, editor)
    {
        editor.setOption("readOnly", false);
    });
    var task_form = $('form#task');
    $("input, button", task_form).removeAttr("disabled");
    task_form.removeClass('form-blur');
    loadingSomething = false;
}

//Reset all alerts
function resetAlerts()
{
    $('#task_alert').html('');
    $('.task_alert_problem').html('');
}

//Increment tries count
function incrementTries()
{
    var ttries = $('#task_tries');
    ttries.text(parseInt(ttries.text()) + 1);
}

//Update task status
function updateTaskStatus(newStatus, grade)
{
    var task_status = $('#task_status');
    var task_grade = $('#task_grade');

    var currentStatus = task_status.text().trim();
    var currentGrade = parseFloat(task_grade.text().trim());

    if(currentStatus != "Succeeded")
        task_status.text(newStatus);
    if(currentGrade < grade)
        task_grade.text(grade);
}

//Creates a new submission (left column)
function displayNewSubmission(id)
{
    var submissions = $('#submissions');
    submissions.find('.submission-empty').remove();

    submissions.prepend($('<a></a>')
        .addClass('submission').addClass('list-group-item')
        .addClass('list-group-item-warning')
        .attr('data-submission-id', id).text(getDateTime()).on('click', clickOnSubmission))
}

//Updates a loading submission
function updateSubmission(id, result, grade)
{
    grade = grade || "0.0";

    var nclass = "";
    if(result == "success") nclass = "list-group-item-success";
    else if(result == "save") nclass = "list-group-item-save";
    else nclass = "list-group-item-danger";
    $('#submissions').find('.submission').each(function()
    {
        if($(this).attr('data-submission-id').trim() == id)
        {
            $(this).removeClass('list-group-item-warning').addClass(nclass);
            $(this).text($(this).text() + " - " + grade + "%");
        }
    });
}

//Submission's click handler
function clickOnSubmission()
{
    if(loadingSomething)
        return;
    loadOldSubmissionInput($(this).attr('data-submission-id'));
}

//Get current datetime
function getDateTime()
{
    var MyDate = new Date();

    return ('0' + MyDate.getDate()).slice(-2) + '/'
        + ('0' + (MyDate.getMonth() + 1)).slice(-2) + '/'
        + MyDate.getFullYear() + " "
        + ('0' + MyDate.getHours()).slice(-2) + ':'
        + ('0' + MyDate.getMinutes()).slice(-2) + ':'
        + ('0' + MyDate.getSeconds()).slice(-2);
}

//Submits a task
function submitTask()
{
    if(loadingSomething)
        return;

    //Must be done before blurTaskForm as when a form is disabled, no input is sent by the plugin
    $('form#task').ajaxSubmit(
        {
            dataType: 'json',
            success:  function(data)
                      {
                          if("status" in data && data["status"] == "ok" && "submissionid" in data)
                          {
                              incrementTries();
                              displayNewSubmission(data['submissionid']);
                              waitForSubmission(data['submissionid']);
                          }
                          else if("status" in data && data['status'] == "error" && "text" in data)
                          {
                              displayTaskErrorAlert(data);
                              updateTaskStatus("Internal error", 0);
                              unblurTaskForm();
                          }
                          else
                          {
                              displayTaskErrorAlert();
                              updateTaskStatus("Internal error", 0);
                              unblurTaskForm();
                          }
                      },
            error:    function()
                      {
                          displayTaskErrorAlert();
                          updateTaskStatus("Internal error", 0);
                          unblurTaskForm();
                      }
        });

    blurTaskForm();
    resetAlerts();
    displayTaskLoadingAlert();
    updateTaskStatus("Waiting for verification", 0);
}

//Wait for a job to end
function waitForSubmission(submissionid)
{
    setTimeout(function()
    {
        var url = $('form#task').attr("action");
        jQuery.post(url, {"@action": "check", "submissionid": submissionid}, null, "json")
            .done(function(data)
            {
                if("status" in data && data['status'] == "waiting")
                    waitForSubmission(submissionid);
                else if("status" in data && "result" in data && "grade" in data)
                {
                    if("debug" in data)
                        displayDebugInfo(data["debug"]);

                    if(data['result'] == "failed")
                    {
                        displayTaskStudentErrorAlert(data);
                        updateSubmission(submissionid, data['result'], data["grade"]);
                        updateTaskStatus("Wrong answer", data["grade"]);
                        unblurTaskForm();
                    }
                    else if(data['result'] == "success")
                    {
                        displayTaskStudentSuccessAlert(data);
                        updateSubmission(submissionid, data['result'], data["grade"]);
                        updateTaskStatus("Succeeded", data["grade"]);
                        unblurTaskForm();
                    }
                    else if(data['result'] == "timeout")
                    {
                        displayTimeOutAlert();
                        updateSubmission(submissionid, data['result'], data["grade"]);
                        updateTaskStatus("Wrong answer", data["grade"]);
                        unblurTaskForm();
                    }
                    else if(data['result'] == "overflow")
                    {
                        displayOverflowAlert();
                        updateSubmission(submissionid, data['result'], data["grade"]);
                        updateTaskStatus("Wrong answer", data["grade"]);
                        unblurTaskForm();
                    }
                    else // == "error"
                    {
                        displayTaskErrorAlert(data);
                        updateSubmission(submissionid, data['result'], data["grade"]);
                        updateTaskStatus("Wrong answer", data["grade"]);
                        unblurTaskForm();
                    }
                }
                else
                {
                    displayTaskErrorAlert("");
                    updateSubmission(submissionid, "error", "0.0");
                    updateTaskStatus("Wrong answer", 0);
                    unblurTaskForm();
                }
            })
            .fail(function()
            {
                displayTaskErrorAlert("");
                updateSubmission(submissionid, "error", "0.0");
                updateTaskStatus("Wrong answer", 0);
                unblurTaskForm();
            });
    }, 1000);
}

//Displays debug info
function displayDebugInfo(info)
{
    displayDebugInfoRecur(info, $('#task_debug'));
}
function displayDebugInfoRecur(info, box)
{
    var data = $(document.createElement('dl'));
    data.text(" ");
    box.html(data);

    jQuery.each(info, function(index, elem)
    {
        var namebox = $(document.createElement('dt'));
        var content = $(document.createElement('dd'));
        data.append(namebox);
        data.append(content);

        namebox.text(index);
        if(jQuery.isPlainObject(elem))
            displayDebugInfoRecur(elem, content);
        else
            content.text(elem);
    });
}

//Displays a loading alert in task form
function displayTaskLoadingAlert()
{
    var task_alert = $('#task_alert');
    task_alert.html(getAlertCode("<b>Verifying your answers...</b>", "info", false));
    $('html, body').animate(
        {
            scrollTop: task_alert.offset().top - 100
        }, 200);
}

//Displays a loading input alert in task form
function displayTaskInputLoadingAlert()
{
    var task_alert = $('#task_alert');
    task_alert.html(getAlertCode("<b>Loading your submission...</b>", "info", false));
    $('html, body').animate(
        {
            scrollTop: task_alert.offset().top - 100
        }, 200);
}

//Displays a loading input alert in task form
function displayTaskInputErrorAlert()
{
    var task_alert = $('#task_alert');
    task_alert.html(getAlertCode("<b>Unable to load this submission</b>", "danger", false));
    $('html, body').animate(
        {
            scrollTop: task_alert.offset().top - 100
        }, 200);
}

//Displays a loading input alert in task form
function displayTaskInputDoneAlert()
{
    var task_alert = $('#task_alert');
    task_alert.html(getAlertCode("<b>Submission loaded</b>", "success", false));
    $('html, body').animate(
        {
            scrollTop: task_alert.offset().top - 100
        }, 200);
}

//Displays an overflow error alert in task form
function displayOverflowAlert(content)
{
    var msg = "<b>Your submission made an overflow.</b>";
    var task_alert = $('#task_alert');
    task_alert.html(getAlertCode(msg, "warning", true));
    $('html, body').animate(
        {
            scrollTop: task_alert.offset().top - 100
        }, 200);
}

//Displays a timeout error alert in task form
function displayTimeOutAlert(content)
{
    var msg = "<b>Your submission timed out.</b>";
    var task_alert = $('#task_alert');
    task_alert.html(getAlertCode(msg, "warning", true));
    $('html, body').animate(
        {
            scrollTop: task_alert.offset().top - 100
        }, 200);
}

//Displays an internal error alert in task form
function displayTaskErrorAlert(content)
{
    var msg = "<b>An internal error occured. Please retry later.</b>";
    if(content != "")
        msg += "<br />Please send an email to the course administrator. Information : " + content.text;

    var task_alert = $('#task_alert');
    task_alert.html(getAlertCode(msg, "danger", true));
    $('html, body').animate(
        {
            scrollTop: task_alert.offset().top - 100
        }, 200);
}

//Displays a student error alert in task form
function displayTaskStudentAlertWithProblems(content, topEmpty, topPrefix, prefix, type, alwaysShowTop)
{
    resetAlerts();

    var firstPos = -1;
    var task_alert = $('#task_alert');

    if("text" in content && content.text != "")
    {
        task_alert.html(getAlertCode(topPrefix + content.text, type, true));
        firstPos = task_alert.offset().top;
    }

    if("problems" in content)
    {
        $(".task_alert_problem").each(function(key, elem)
        {
            var problemid = elem.id.substr(11); //skip "task_alert."
            if(problemid in content.problems)
            {
                $(elem).html(getAlertCode(prefix + content.problems[problemid], type, true));
                if(firstPos == -1 || firstPos > $(elem).offset().top)
                    firstPos = $(elem).offset().top;
            }
        });
    }

    if(firstPos == -1 || (alwaysShowTop && !("text" in content && content.text != "")))
    {
        task_alert.html(getAlertCode(topEmpty, type, true));
        firstPos = task_alert.offset().top;
    }

    $('html, body').animate(
        {
            scrollTop: firstPos - 100
        }, 200);
}

//Displays a student error alert in task form
function displayTaskStudentErrorAlert(content)
{
    displayTaskStudentAlertWithProblems(content,
        "<b>There are some errors in your answer. Your score is " + content["grade"] + "%</b>",
        "<b>There are some errors in your answer. Your score is " + content["grade"] + "%</b><br/>",
        "<b>There are some errors in your answer:</b><br/>",
        "danger", false);
}

//Displays a student success alert in task form
function displayTaskStudentSuccessAlert(content)
{
    displayTaskStudentAlertWithProblems(content,
        "<b>Your answer passed the tests! Your score is " + content["grade"] + "%</b>",
        "<b>Your answer passed the tests! Your score is " + content["grade"] + "%</b><br/>",
        "",
        "success", true);
}

//Create an alert
//type is either alert, info, danger, warning
//dismissible is a boolean
function getAlertCode(content, type, dismissible)
{
    var a = '<div class="alert fade in ';
    if(dismissible)
        a += 'alert-dismissible ';
    a += 'alert-' + type + '" role="alert">';
    if(dismissible)
        a += '<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>';
    a += content;
    a += '</div>';
    return a;
}

//Load an old submission input
function loadOldSubmissionInput(id)
{
    if(loadingSomething)
        return;

    blurTaskForm();
    resetAlerts();
    displayTaskInputLoadingAlert();

    var url = $('form#task').attr("action");
    jQuery.post(url, {"@action": "load_submission_input", "submissionid": id}, null, "json")
        .done(function(data)
        {
            if("status" in data && data['status'] == "ok" && "input" in data)
            {
                unblurTaskForm();
                loadOldFeedback(data);
                loadInput(id, data['input']);
            }
            else
            {
                displayTaskInputErrorAlert();
                unblurTaskForm();
            }
        }).fail(function()
        {
            displayTaskInputErrorAlert();
            unblurTaskForm();
        });
}

//Load feedback from an old submission
function loadOldFeedback(data)
{
    if("status" in data && "result" in data)
    {
        if("debug" in data)
            displayDebugInfo(data["debug"]);

        if(data['result'] == "failed")
            displayTaskStudentErrorAlert(data);
        else if(data['result'] == "success")
            displayTaskStudentSuccessAlert(data);
        else if(data['result'] == "timeout")
            displayTimeOutAlert();
        else if(data['result'] == "overflow")
            displayOverflowAlert();
        else // == "error"
            displayTaskErrorAlert(data);
    }
    else
        displayTaskErrorAlert("");
}

//Load data from input into the form inputs
function loadInput(submissionid, input)
{
    $('form#task input').each(function()
    {
        if($(this).attr('type') == "hidden") //do not try to change @action
            return;

        var id = $(this).attr('name');

        if(id in input)
        {
            if($(this).attr('type') != "checkbox" && $(this).attr('type') != "radio" && $(this).attr('type') != "file")
                $(this).prop('value', input[id]);
            else if($(this).attr('type') == "checkbox" && jQuery.isArray(input[id]) && $.inArray(parseInt($(this).prop('value')), input[id]))
                $(this).prop('checked', true);
            else if($(this).attr('type') == "radio" && parseInt($(this).prop('value')) == input[id])
                $(this).prop('checked', true);
            else if($(this).attr('type') == "checkbox" || $(this).attr('type') == "radio")
                $(this).prop('checked', false);
            else if($(this).attr('type') == 'file')
            {
                //display the download button associated with this file
                var input_file = $('#download-input-file-' + id);
                input_file.attr('href', $('form#task').attr("action") + "?submissionid=" + submissionid + "&questionid=" + id);
                input_file.css('display', 'block');
            }
        }
        else if($(this).attr('type') == "checkbox" || $(this).attr('type') == "radio")
            $(this).prop('checked', false);
        else
            $(this).prop('value', '');
    });

    $.each(codeEditors, function()
    {
        var name = this.getTextArea().name;
        if(name in input)
            this.setValue(input[name], -1);
        else
            this.setValue("");
    })
}