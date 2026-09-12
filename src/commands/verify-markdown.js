import fs from "node:fs";
import path from "node:path";

function relativeDate(iso) {
    if (!iso) {
        return "unknown date";
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return "unknown date";
    }

    const days =
        Math.floor(
            (Date.now() - date.getTime()) /
            86400000
        );

    if (days <= 0) {
        return "today";
    }

    if (days === 1) {
        return "1 day ago";
    }

    return `${days} days ago`;
}

function escapeCell(value) {
    return String(value ?? "unknown")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ");
}

export function renderVerifyMarkdown(
    projectRoot,
    generatedAt,
    summary,
    results
) {
    const lines = [];

    lines.push("# PlanMap Verify");
    lines.push("");
    lines.push(`Project: \`${projectRoot}\``);
    lines.push(`Generated: \`${generatedAt}\``);
    lines.push("");

    lines.push("## Summary");
    lines.push("");
    lines.push("| Status | Count |");
    lines.push("|---|---:|");
    lines.push(`| Approved | ${summary.approved} |`);
    lines.push(`| Verified | ${summary.verified} |`);
    lines.push(`| Drifted | ${summary.drifted} |`);
    lines.push(`| Errors | ${summary.errors} |`);
    lines.push(`| Unsupported | ${summary.unsupported} |`);
    lines.push("");

    const drifted =
        results.filter(
            result =>
                result.status === "drifted"
        );

    if (drifted.length > 0) {
        lines.push("## Drifted");
        lines.push("");

        for (const result of drifted) {
            lines.push(`### \`${escapeCell(result.identity)}\``);
            lines.push("");
            lines.push(
                `**Intent:** ${escapeCell(result.intent)}`
            );
            lines.push(
                `**Approver:** ${escapeCell(result.approvedBy)}`
            );
            lines.push(
                `**Approved:** ${relativeDate(result.approvedAt)}`
            );
            lines.push("");

            const violations =
                result.violations ?? [];

            if (violations.length > 0) {
                lines.push(
                    "| Violation |"
                );
                lines.push(
                    "|---|"
                );

                for (const violation of violations) {
                    lines.push(
                        `| ${escapeCell(
                            violation.reason ??
                            violation.message ??
                            "constraint failed"
                        )} |`
                    );
                }

                lines.push("");
            }

            const impact =
                result.impact ?? [];

            if (impact.length > 0) {
                lines.push(
                    "| Impact | Confidence |"
                );
                lines.push(
                    "|---|---|"
                );

                for (const item of impact) {
                    lines.push(
                        `| ${escapeCell(
                            item.identity ??
                            item.target
                        )} | ${escapeCell(
                            item.confidence
                        )} |`
                    );
                }

                lines.push("");
            }
        }
    }

    const errors =
        results.filter(
            result =>
                result.status === "error"
        );

    if (errors.length > 0) {
        lines.push("## Errors");
        lines.push("");

        for (const result of errors) {
            lines.push(`### \`${escapeCell(result.identity)}\``);
            lines.push("");

            for (const error of result.errors ?? []) {
                lines.push(
                    `- ${escapeCell(error.message ?? error)}`
                );
            }

            lines.push("");
        }
    }

    const unsupported = [];

    for (const result of results) {
        for (const item of result.unsupported ?? []) {
            unsupported.push({
                identity: result.identity,
                item
            });
        }
    }

    if (unsupported.length > 0) {
        lines.push("## Unsupported");
        lines.push("");

        for (const item of unsupported) {
            lines.push(
                `- \`${escapeCell(item.identity)}\`: ${escapeCell(
                    typeof item.item === "string"
                        ? item.item
                        : JSON.stringify(item.item)
                )}`
            );
        }

        lines.push("");
    }

    return `${lines.join("\n").trimEnd()}\n`;
}

export function writeVerifyMarkdown(
    projectRoot,
    generatedAt,
    summary,
    results
) {
    const markdownPath =
        path.join(
            projectRoot,
            "VERIFY.md"
        );

    const markdown =
        renderVerifyMarkdown(
            projectRoot,
            generatedAt,
            summary,
            results
        );

    fs.writeFileSync(
        markdownPath,
        markdown,
        "utf8"
    );

    return markdownPath;
}
