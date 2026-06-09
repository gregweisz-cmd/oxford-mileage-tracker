/**
 * Shared support-ticket footer for how-to guide PDFs and HTML templates.
 */
const SUPPORT_TICKET_URL = 'https://tinyurl.com/ExpenseTrackerFeedback';
const SUPPORT_TICKET_LABEL = 'tinyurl.com/ExpenseTrackerFeedback';

const HTML_FOOTER_SUPPORT_LINE = `<p>Submit feedback or request support: <a href="${SUPPORT_TICKET_URL}">${SUPPORT_TICKET_LABEL}</a></p>`;

const MARKDOWN_FOOTER = `---

*Submit feedback or request support: [${SUPPORT_TICKET_LABEL}](${SUPPORT_TICKET_URL})*
`;

function pdfFooterTemplate() {
    return `
                <div style="font-size: 8px; text-align: center; width: 100%; color: #666; padding-bottom: 8px; line-height: 1.35;">
                    <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
                    <div>Feedback &amp; support: <a href="${SUPPORT_TICKET_URL}" style="color: #1976d2; text-decoration: none;">${SUPPORT_TICKET_LABEL}</a></div>
                </div>
            `;
}

module.exports = {
    SUPPORT_TICKET_URL,
    SUPPORT_TICKET_LABEL,
    HTML_FOOTER_SUPPORT_LINE,
    MARKDOWN_FOOTER,
    pdfFooterTemplate,
};
