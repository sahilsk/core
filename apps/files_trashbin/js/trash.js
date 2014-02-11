/* global OC, t, BreadCrumb, FileActions, FileList, Files */
$(document).ready(function() {
	var deletedRegExp = new RegExp(/^(.+)\.d[0-9]+$/);

	/**
	 * Convert a file name in the format filename.d12345 to the real file name.
	 * This will use basename.
	 * The name will not be changed if it has no ".d12345" suffix.
	 * @param name file name
	 * @return converted file name
	 */
	function getDeletedFileName(name) {
		name = OC.basename(name);
		var match = deletedRegExp.exec(name);
		if (match && match.length > 1) {
			name = match[1];
		}
		return name;
	}

	function isDirListing() {
		var dir = FileList.getCurrentDirectory();
		return (dir !== '/' && dir !== '');
	}

	function removeCallback(result) {
		if (result.status !== 'success') {
			OC.dialogs.alert(result.data.message, t('core', 'Error'));
		}

		var files = result.data.success;
		for (var i = 0; i < files.length; i++) {
			FileList.remove(OC.basename(files[i].filename), {updateSummary: false});
		}
		FileList.updateFileSummary();
		FileList.updateEmptyContent();
		enableActions();
	}

	if (typeof FileActions !== 'undefined') {
		FileActions.register('all', 'Restore', OC.PERMISSION_READ, OC.imagePath('core', 'actions/history'), function(filename) {
			var dirListing = isDirListing();
			var tr = FileList.findFileEl(filename);
			var deleteAction = tr.children("td.date").children(".action.delete");
			var dir = FileList.getCurrentDirectory();
			deleteAction.removeClass('delete-icon').addClass('progress-icon');
			disableActions();
			$.post(OC.filePath('files_trashbin', 'ajax', 'undelete.php'), {
					files: JSON.stringify([dir + '/' + filename]),
					dirlisting: dirListing ? 1 : 0
				},
			    removeCallback
			);

		});
	};

	FileActions.register('all', 'Delete', OC.PERMISSION_READ, function() {
		return OC.imagePath('core', 'actions/delete');
	}, function(filename) {
		$('.tipsy').remove();
		var dirListing = isDirListing();
		var tr = FileList.findFileEl(filename);
		var deleteAction = tr.children("td.date").children(".action.delete");
		var dir = FileList.getCurrentDirectory();
		deleteAction.removeClass('delete-icon').addClass('progress-icon');
		disableActions();
		$.post(OC.filePath('files_trashbin', 'ajax', 'delete.php'), {
				files: JSON.stringify([dir + '/' + filename]),
				dirlisting: dirListing ? 1 : 0
			},
			removeCallback
		);

	});

	// Sets the select_all checkbox behaviour :
	$('#select_all').click(function() {
		if ($(this).attr('checked')) {
			// Check all
			$('td.filename input:checkbox').attr('checked', true);
			$('td.filename input:checkbox').parent().parent().addClass('selected');
		} else {
			// Uncheck all
			$('td.filename input:checkbox').attr('checked', false);
			$('td.filename input:checkbox').parent().parent().removeClass('selected');
		}
		procesSelection();
	});

	$('.undelete').click('click', function(event) {
		event.preventDefault();
		var files = getSelectedFiles('file');
		var fileslist = JSON.stringify(files);
		var dirlisting = getSelectedFiles('dirlisting')[0];
		disableActions();
		for (var i = 0; i < files.length; i++) {
			var deleteAction = FileList.findFileEl(files[i]).children("td.date").children(".action.delete");
			deleteAction.removeClass('delete-icon').addClass('progress-icon');
		}

		$.post(OC.filePath('files_trashbin', 'ajax', 'undelete.php'),
				{files: fileslist, dirlisting: dirlisting},
				removeCallback
		);
	});

	$('.delete').click('click', function(event) {
		event.preventDefault();
		var allFiles = $('#select_all').is(':checked');
		var files = [];
		var params = {};
		if (allFiles) {
			params = {
			   allfiles: true,
			   dir: $('#dir').val()
			};
		}
		else {
			files = getSelectedFiles('file');
			params = {
				files: JSON.stringify(files),
				dirlisting: getSelectedFiles('dirlisting')[0]
			};
		}

		disableActions();
		if (allFiles) {
			FileList.showMask();
		}
		else {
			for (var i = 0; i < files.length; i++) {
				var deleteAction = FileList.findFileEl(files[i]).children("td.date").children(".action.delete");
				deleteAction.removeClass('delete-icon').addClass('progress-icon');
			}
		}

		$.post(OC.filePath('files_trashbin', 'ajax', 'delete.php'),
				params,
				function(result) {
					if (allFiles) {
						if (result.status !== 'success') {
							OC.dialogs.alert(result.data.message, t('core', 'Error'));
						}
						FileList.hideMask();
						// simply remove all files
						FileList.setFiles([]);
						enableActions();
					}
					else {
						removeCallback(result);
					}
				}
		);

	});

	$('#fileList').on('click', 'td.filename input', function() {
		var checkbox = $(this).parent().children('input:checkbox');
		$(checkbox).parent().parent().toggleClass('selected');
		if ($(checkbox).is(':checked')) {
			var selectedCount = $('td.filename input:checkbox:checked').length;
			if (selectedCount === $('td.filename input:checkbox').length) {
				$('#select_all').prop('checked', true);
			}
		} else {
			$('#select_all').prop('checked',false);
		}
		procesSelection();
	});

	$('#fileList').on('click', 'td.filename a', function(event) {
		var mime = $(this).parent().parent().data('mime');
		if (mime !== 'httpd/unix-directory') {
			event.preventDefault();
		}
		var filename = $(this).parent().parent().attr('data-file');
		var tr = FileList.findFileEl(filename);
		var renaming = tr.data('renaming');
		if(!renaming){
			if(mime.substr(0, 5) === 'text/'){ //no texteditor for now
				return;
			}
			var type = $(this).parent().parent().data('type');
			var permissions = $(this).parent().parent().data('permissions');
			var action = FileActions.getDefault(mime, type, permissions);
			if(action){
				event.preventDefault();
				action(filename);
			}
		}
	});

	/**
	 * Override crumb URL maker (hacky!)
	 */
	FileList.breadcrumb.getCrumbUrl = function(part, index) {
		if (index === 0) {
			return OC.linkTo('files', 'index.php');
		}
		return OC.linkTo('files_trashbin', 'index.php')+"?dir=" + encodeURIComponent(part.dir);
	};

	Files.getDownloadUrl = function(action, params) {
		// no downloads
		return '#';
	};

	Files.getAjaxUrl = function(action, params) {
		var q = '';
		if (params) {
			q = '?' + OC.buildQueryString(params);
		}
		return OC.filePath('files_trashbin', 'ajax', action + '.php') + q;
	};


	/**
	 * Override crumb making to add "Deleted Files" entry
	 * and convert files with ".d" extensions to a more
	 * user friendly name.
	 */
	var oldMakeCrumbs = BreadCrumb.prototype._makeCrumbs;
	BreadCrumb.prototype._makeCrumbs = function() {
		var parts = oldMakeCrumbs.apply(this, arguments);
		// duplicate first part
		parts.unshift(parts[0]);
		parts[1] = {
			dir: '/',
			name: t('files_trashbin', 'Deleted Files')
		};
		for (var i = 2; i < parts.length; i++) {
			parts[i].name = getDeletedFileName(parts[i].name);
		}
		return parts;
	};

	FileActions.actions.dir = {
		// only keep 'Open' action for navigation
		'Open': FileActions.actions.dir.Open
	};
});

/**
 * @brief get a list of selected files
 * @param string property (option) the property of the file requested
 * @return array
 *
 * possible values for property: name, mime, size and type
 * if property is set, an array with that property for each file is returnd
 * if it's ommited an array of objects with all properties is returned
 */
function getSelectedFiles(property){
	var elements=$('td.filename input:checkbox:checked').parent().parent();
	var files=[];
	elements.each(function(i,element){
		var file={
			name:$(element).attr('data-filename'),
			file:$('#dir').val() + "/" + $(element).attr('data-file'),
			timestamp:$(element).attr('data-timestamp'),
			type:$(element).attr('data-type'),
			dirlisting:$(element).attr('data-dirlisting')
		};
		if(property){
			files.push(file[property]);
		}else{
			files.push(file);
		}
	});
	return files;
}

function enableActions() {
	$(".action").css("display", "inline");
	$(":input:checkbox").css("display", "inline");
}

function disableActions() {
	$(".action").css("display", "none");
	$(":input:checkbox").css("display", "none");
}

