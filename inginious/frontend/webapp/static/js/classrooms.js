//
// This file is part of INGInious. See the LICENSE and the COPYRIGHTS files for
// more information about the licensing of this file.
//
"use strict";

function classroom_prepare_submit()
{
    $("#groups .group").each(function(i) {

        var group = {"size": parseInt($(this).find("#size").val()), "students": []};
        $(this).find(".group-entry").each(function(j) {
            group["students"].push($(this).data('username'));
        });

        var inputField = jQuery('<input/>', {
            type:"hidden",
            name:"groups",
            value: JSON.stringify(group)
        }).appendTo(this);

    });
}

function classroom_group_add()
{
    // New group hidden item
    var new_group_li = $("#groups .panel").last();

    // Clone and change id for deletion
    var clone = new_group_li.clone();
    clone.attr("id", parseInt(clone.attr("id")) + 1);
    clone.find("#group_number").text(clone.attr("id"));

    // Remove the hidden style attribute and push
    new_group_li.removeAttr("style");
    new_group_li.addClass("group");
    new_group_li.after(clone);

    // Regroup sortable lists
    $("ul.students").sortable({group:"students"});
}

function classroom_group_delete(id)
{
    // Append all the items to ungrouped users
    $("#" + id).find("li").each(function(index) {
        $(this).appendTo("#group_0");
    });

    // Remove item...
    $("#" + id).remove();

    // Renumbering groups
    $("#groups .group-panel").each(function(index) {
        $(this).attr("id", index);
        $(this).find("#group_number").text(index+1);
    });
}

function classroom_groups_delete() {
    $("#groups .group").each(function(i) {
        classroom_group_delete($(this).attr("id"));
    });
}

function classroom_groups_clean() {
    $("#groups .group").each(function(i) {
        $("#" + $(this).attr("id")).find("li").each(function(index) {
            $(this).appendTo("#group_0");
        });
    });
}

function classroom_tutor_add(username, complete_name) {

    var new_tutor_div = $("#tutors li").last();
    var clone = new_tutor_div.clone();

    new_tutor_div.attr("id", username);
    new_tutor_div.find("span").text(complete_name);

    new_tutor_div.removeAttr("style");
    new_tutor_div.after(clone);

    jQuery('<input/>', {
            type:"hidden",
            name:"tutors",
            value: username
        }).appendTo(new_tutor_div);

    // Add entry in user list for user
    // Remove user from select list and disable select if empty
    $("#tutor_list option[value='"+ username +"']").remove();
    if(!$("#tutor_list").val())
        $("#tutor_list").prop("disabled", true);
}

function classroom_student_add() {
    if($("#tab_registered_student").hasClass("active")) {

        var new_li = jQuery('<li/>', {
            'class':"list-group-item group-entry",
            'data-username':$("#registered_students :selected").val()
        });

        jQuery('<span/>', {
            id: new_li.data("username"),
            text: $("#registered_students :selected").text()
        }).appendTo(new_li);

        $("#registered_students :selected").remove();
        if(!$("#registered_students").val())
            $("#registered_students").prop("disabled", true);
    }
    else {
        var new_li = jQuery('<li/>', {
            'class':"list-group-item group-entry",
            'data-username': $("#new_student").val()
        });

        jQuery('<span/>', {
            id: new_li.data("username"),
            text: $("#new_student").val() + ' (will be registered)'
        }).appendTo(new_li);
    }

    var user_del_link = jQuery('<a/>', {
        'class': "pull-right",
        'id': 'user_delete',
        'href': '#',
        'onclick': "javascript:classroom_student_remove('" + new_li.data("username") + "')",
        'data-toggle': 'tooltip',
        'data-placement': 'left',
        'title': 'Remove student'
    });

    jQuery('<i/>', {
        'class': 'fa fa-user-times'
    }).appendTo(user_del_link);

    new_li.append(user_del_link);
    new_li.appendTo($("#group_0"));

    $("#student_modal").modal('hide');
}

function classroom_student_remove(username) {
    jQuery('<option/>', {
        value: username,
        text:  $("#" + username).text()
    }).appendTo($("#registered_students"));

    $("#registered_students").prop("disabled", false);

    $(".group-entry[data-username='" + username + "']").remove();
}

function classroom_tutor_remove(username) {
    // Put user back to select list
    jQuery('<option/>', {
        value: username,
        text:  $("#" + username).text()
    }).appendTo($("#tutor_list"));

    $("#tutor_list").prop("disabled", false);

    // Remove user from user list
    $("#" + username).remove();
}

function classroom_delete() {
    jQuery('<input/>', {
        type:'hidden',
        name: 'delete'
    }).appendTo($('form'));

    $('form').submit();
}