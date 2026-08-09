/// A wikilink and the byte ranges needed to rewrite its target without changing its alias or
/// anchor.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WikilinkMatch {
    pub start: usize,
    pub end: usize,
    pub target_start: usize,
    pub target_end: usize,
    pub target: String,
}

/// Finds narrow `[[...]]` wikilinks. Brackets inside a candidate invalidate that candidate.
pub fn find_wikilinks(source: &str) -> Vec<WikilinkMatch> {
    let bytes = source.as_bytes();
    let mut matches = Vec::new();
    let mut cursor = 0;

    while cursor + 1 < bytes.len() {
        if bytes[cursor] != b'[' || bytes[cursor + 1] != b'[' {
            cursor += 1;
            continue;
        }

        let content_start = cursor + 2;
        let mut content_end = None;
        let mut index = content_start;
        while index < bytes.len() {
            match bytes[index] {
                b'[' => break,
                b']' if bytes.get(index + 1) == Some(&b']') => {
                    content_end = Some(index);
                    break;
                }
                b']' => break,
                _ => index += 1,
            }
        }

        let Some(content_end) = content_end else {
            cursor += 1;
            continue;
        };

        let alias_start = source[content_start..content_end]
            .find('|')
            .map(|offset| content_start + offset)
            .unwrap_or(content_end);
        let target_end = source[content_start..alias_start]
            .find(['#', '^'])
            .map(|offset| content_start + offset)
            .unwrap_or(alias_start);
        let end = content_end + 2;

        matches.push(WikilinkMatch {
            start: cursor,
            end,
            target_start: content_start,
            target_end,
            target: source[content_start..target_end].to_owned(),
        });
        cursor = end;
    }

    matches
}

/// Replaces complete wikilink targets matching `old_stem`, keeping their surrounding whitespace,
/// aliases, anchors, and all nonmatching text unchanged.
pub fn rewrite_targets(source: &str, old_stem: &str, new_stem: &str) -> Option<(String, usize)> {
    let old_stem = old_stem.to_lowercase();
    let matches = find_wikilinks(source);
    let mut output = String::with_capacity(source.len());
    let mut cursor = 0;
    let mut rewritten = 0;

    for wikilink in matches {
        if wikilink.target.trim().to_lowercase() != old_stem {
            continue;
        }

        let leading_whitespace = wikilink.target.len() - wikilink.target.trim_start().len();
        let trailing_whitespace = wikilink.target.len() - wikilink.target.trim_end().len();
        let target_start = wikilink.target_start + leading_whitespace;
        let target_end = wikilink.target_end - trailing_whitespace;

        output.push_str(&source[cursor..target_start]);
        output.push_str(new_stem);
        cursor = target_end;
        rewritten += 1;
    }

    if rewritten == 0 {
        return None;
    }

    output.push_str(&source[cursor..]);
    Some((output, rewritten))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_wikilinks_should_parse_plain_links() {
        let matches = find_wikilinks("before [[Note]] after");

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].target, "Note");
        assert_eq!(
            &"before [[Note]] after"[matches[0].start..matches[0].end],
            "[[Note]]"
        );
    }

    #[test]
    fn rewrite_targets_should_preserve_aliases() {
        let rewritten = rewrite_targets("[[ Old |Visible text]]", "old", "New");

        assert_eq!(rewritten, Some(("[[ New |Visible text]]".into(), 1)));
    }

    #[test]
    fn rewrite_targets_should_preserve_heading_and_block_anchors() {
        let rewritten = rewrite_targets("[[Old#Heading]] and [[Old^block-id]]", "Old", "New");

        assert_eq!(
            rewritten,
            Some(("[[New#Heading]] and [[New^block-id]]".into(), 2))
        );
    }

    #[test]
    fn rewrite_targets_should_compare_targets_case_insensitively() {
        let rewritten = rewrite_targets("[[oLd]]", "OLD", "New");

        assert_eq!(rewritten, Some(("[[New]]".into(), 1)));
    }

    #[test]
    fn rewrite_targets_should_not_match_target_prefixes() {
        let rewritten = rewrite_targets("[[Old notes]]", "Old", "New");

        assert_eq!(rewritten, None);
    }

    #[test]
    fn rewrite_targets_should_return_none_when_no_links_match() {
        let rewritten = rewrite_targets("plain text", "Old", "New");

        assert_eq!(rewritten, None);
    }

    #[test]
    fn rewrite_targets_should_rewrite_multiple_links_in_order() {
        let rewritten = rewrite_targets("[[Old]] then [[Old|alias]]", "Old", "New");

        assert_eq!(rewritten, Some(("[[New]] then [[New|alias]]".into(), 2)));
    }

    #[test]
    fn rewrite_targets_should_compare_non_ascii_stems_case_insensitively() {
        let rewritten = rewrite_targets("[[Ärger]]", "ärger", "Freude");

        assert_eq!(rewritten, Some(("[[Freude]]".into(), 1)));
    }
}
