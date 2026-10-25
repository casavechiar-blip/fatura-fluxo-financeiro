<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Excel export rewrites only the Movimentos data rows inside the user's original workbook (src/lib/export-xlsx.ts via JSZip) so every other sheet, formula, table and pivot survives untouched.
- Seed rows from the original spreadsheet were inserted unowned; `claim_seed_data()` assigns them to the first signed-in user. Never sign up a test account before the owner logs in.
