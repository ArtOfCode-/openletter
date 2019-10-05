$(() => {
    let expanded = false;
    let text;

    $('.js-expand-signatories').on('click', evt => {
        evt.preventDefault();
        if (expanded) {
            $('.signatory-panel, .shadow').css({
                'max-height': '30em',
                'overflow-y': 'scroll'
            });
            $(evt.target).html(text);
        }
        else {
            text = $(evt.target).html();
            $('.signatory-panel, .shadow').css({
                'max-height': 'unset',
                'overflow-y': 'hidden'
            });
            $(evt.target).html('Contract &uarr;');
        }
        expanded = !expanded;
    });

    let darkMode = false;

    $('.color-mode-toggle').on('click', evt => {
        if (darkMode) {
            $('#dark-sheet').attr('href', '#');
        }
        else {
            $('#dark-sheet').attr('href', '/stylesheets/dark.css');
        }
        darkMode = !darkMode;
    });
});