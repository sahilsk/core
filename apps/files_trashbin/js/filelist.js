/* global OC, FileList, t */
(function() {
	// override reload with own ajax call
	var oldCreateRow = FileList._createRow;
	FileList._createRow = function() {
		// FIXME: MEGAHACK until we find a better solution
		var tr = oldCreateRow.apply(this, arguments);
		tr.find('td.filesize').remove();
		return tr;
	};

	FileList._onClickBreadCrumb = function(e) {
		var $el = $(e.target).closest('.crumb'),
			index = $el.index(),
			$targetDir = $el.data('dir');
		// first one is home, let the link makes it default action
		if (index !== 0) {
			e.preventDefault();
			FileList.changeDirectory($targetDir);
		}
	};

	var oldAdd = FileList.add;
	FileList.add = function(fileData, options) {
		options = options || {};
		var dir = FileList.getCurrentDirectory();
		var dirListing = dir !== '' && dir !== '/';
		if (!dirListing) {
			fileData.displayName = fileData.name;
			fileData.name = fileData.name + '.d' + fileData.timestamp;
		}
		// show deleted time as mtime
		if (fileData.timestamp) {
			fileData.mtime = parseInt(fileData.timestamp, 10) * 1000;
		}
		return oldAdd.call(this, fileData, options);
	};

	FileList.linkTo = function(dir){
		return OC.linkTo('files_trashbin', 'index.php')+"?dir="+ encodeURIComponent(dir).replace(/%2F/g, '/');
	};

	FileList.updateEmptyContent = function(){
		var $fileList = $('#fileList');
		var exists = $fileList.find('tr:first').exists();
		$('#emptycontent').toggleClass('hidden', exists);
		$('#filestable th').toggleClass('hidden', !exists);
	};

	var oldInit = FileList.initialize;
	FileList.initialize = function() {
		var result = oldInit.apply(this, arguments);
		$('.undelete').click('click', FileList._onClickRestoreSelected);
		return result;
	};

	FileList._removeCallback = function(result) {
		if (result.status !== 'success') {
			OC.dialogs.alert(result.data.message, t('core', 'Error'));
		}

		var files = result.data.success;
		var $el;
		for (var i = 0; i < files.length; i++) {
			$el = FileList.remove(OC.basename(files[i].filename), {updateSummary: false});
			FileList.fileSummary.remove({type: $el.attr('data-type'), size: $el.attr('data-size')});
		}
		FileList.fileSummary.update();
		FileList.updateEmptyContent();
		enableActions();
	}


	FileList._onClickRestoreSelected = function(event) {
		event.preventDefault();
		var files = FileList.getSelectedFiles('name');
		disableActions();
		for (var i = 0; i < files.length; i++) {
			var deleteAction = FileList.findFileEl(files[i]).children("td.date").children(".action.delete");
			deleteAction.removeClass('delete-icon').addClass('progress-icon');
		}

		$.post(OC.filePath('files_trashbin', 'ajax', 'undelete.php'), {
				files: JSON.stringify(files),
				dir: FileList.getCurrentDirectory()
			},
			FileList._removeCallback
		);
	};

	FileList._onClickDeleteSelected = function(event) {
		event.preventDefault();
		var allFiles = $('#select_all').is(':checked');
		var files = [];
		var params = {};
		if (allFiles) {
			params = {
				allfiles: true,
				dir: FileList.getCurrentDirectory()
			};
		}
		else {
			files = FileList.getSelectedFiles('name');
			params = {
				files: JSON.stringify(files),
				dir: FileList.getCurrentDirectory()
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
						FileList._removeCallback(result);
					}
				}
		);

	};

	var oldClickFile = FileList._onClickFile;
	FileList._onClickFile = function(event) {
		var mime = $(this).parent().parent().data('mime');
		if (mime !== 'httpd/unix-directory') {
			event.preventDefault();
		}
		return oldClickFile.apply(this, arguments);
	};

})();
