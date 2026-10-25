const $ = id => document.getElementById(id);
const fileInput = $('backup-file');
let backupFile = null, backupData = null;

function inspectBackup(value) {
  if (!value || value.format !== 'webos-profile-backup' || ![1, 2].includes(value.version)) throw new Error('Este ficheiro não é um backup WebOS compatível.');
  if (!value.profile || typeof value.profile.name !== 'string' || !Array.isArray(value.files) || !Array.isArray(value.appData) || !value.settings) throw new Error('O backup está incompleto ou mal formado.');
  if (value.files.length > 10000 || value.appData.length > 10000) throw new Error('O backup excede o limite de registos.');
  return { files: value.files.length, appKeys: value.appData.length, sourceName: value.profile.name, createdAt: value.createdAt };
}

$('choose-file').onclick = () => fileInput.click();
fileInput.onchange = async () => {
  backupFile = fileInput.files?.[0] ?? null; backupData = null; $('restore').disabled = true; $('preview').hidden = true;
  if (!backupFile) return;
  try {
    if (backupFile.size > 50 * 1024 * 1024) throw new Error('O ficheiro excede o limite de 50 MB.');
    backupData = JSON.parse(await backupFile.text());
    const details = inspectBackup(backupData);
    $('preview').textContent = `Backup de ${details.sourceName} · ${details.files} itens no filesystem · ${details.appKeys} registos de apps · ${new Date(details.createdAt).toLocaleString('pt-PT')}`;
    $('preview').hidden = false; $('restore').disabled = false;
    os.ui.status('status', `Ficheiro validado: ${backupFile.name}`, 'success');
  } catch (error) { backupFile = null; backupData = null; os.ui.status('status', os.errors.message(error), 'error'); }
};
$('export').onclick = async () => {
  try {
    const backup = await os.ui.run({ button: $('export'), status: 'status', loading: 'A preparar o backup…' }, () => os.profileBackup.export());
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `webos-backup-${backup.profile.id}-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    os.ui.status('status', `Backup exportado: ${backup.files.length} itens e ${backup.appData.length} registos de apps.`, 'success');
  } catch { /* O estado de erro já foi mostrado pelo helper. */ }
};
$('restore').onclick = async () => {
  if (!backupData || !backupFile) return;
  const accepted = await os.dialog.confirm({ title: 'Substituir dados do perfil?', message: `O restauro substituirá todos os dados privados das aplicações e o conteúdo da pasta pessoal. As definições também serão restauradas. Esta ação não pode ser anulada. Continuar com o backup de ${backupData.profile.name}?`, okLabel: 'Restaurar dados', danger: true });
  if (!accepted) return;
  try {
    const result = await os.ui.run({ button: $('restore'), status: 'status', loading: 'A validar e restaurar os dados…' }, () => os.profileBackup.restore(backupData));
    backupData = null; backupFile = null; fileInput.value = ''; $('restore').disabled = true; $('preview').hidden = true;
    os.ui.status('status', `Restauro concluído: ${result.files} itens e ${result.appKeys} registos de apps.`, 'success');
  } catch { /* O estado de erro já foi mostrado pelo helper. */ }
};