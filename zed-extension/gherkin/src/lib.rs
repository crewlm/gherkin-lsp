use zed_extension_api::{self as zed, Result};

struct GherkinExtension;

impl zed::Extension for GherkinExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let server_path = if worktree.read_text_file("bin/gherkin-lsp.cjs").is_ok() {
            format!("{}/bin/gherkin-lsp.cjs", worktree.root_path())
        } else {
            "/Users/viktorforsman/Code/language-server/bin/gherkin-lsp.cjs".to_string()
        };

        let mut env = Vec::new();
        let carmen_steps = "lib/python/carmtest/behave/steps";
        if worktree
            .read_text_file(&format!("{}/__init__.py", carmen_steps))
            .is_ok()
        {
            env.push((
                "GHERKIN_LSP_STEPS".to_string(),
                format!("{}/{}", worktree.root_path(), carmen_steps),
            ));
        }

        Ok(zed::Command {
            command: "/opt/homebrew/bin/node".to_string(),
            args: vec![server_path, "--stdio".to_string()],
            env,
        })
    }
}

zed::register_extension!(GherkinExtension);
