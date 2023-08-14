let apiPermissions = new Map()

  .set("/users_get",["p_emploees","p_editclocking","p_scans","p_vacations","p_audit","p_departments", "p_audit", "p_history", "p_reports"])
  .set("/users_get_transfer", ["p_emploees"])
  .set("/users_get_deactivated", ["p_admin"])
  .set("/users_add",["p_emploees"])
  .set("/users_edit",["p_emploees"]) //! si cei care nu am p_advanced_users_edit pot trimite req de edit avansat
  .set("/users_deactivate",["p_advanced_users_edit"])
  .set("/users_reactivate",["p_admin"])
  .set("/users_remove", ["p_admin"])
  .set("/users_import",["p_emploees"])
  .set("/users_change_subgroup_all", ["p_admin", "p_emploees"])

  .set("/overtime_get",["p_present"])
  .set("/late_get",["p_present"])


  .set("/scans_get",["p_scans","p_editclocking", "p_history"])
  .set("/scans_get_id",["p_editclocking"])
  .set("/scans_add",["p_editclocking"])
  .set("/scans_edit",["p_editclocking"])
  .set("/scans_remove",["p_editclocking"])
  .set("/utils_get_inout",["p_editclocking", "p_audit", "p_reports"])
  .set("/get_clocking_data",["p_editclocking", "p_emploees"])
  .set("/api_edit_clocking",["p_editclocking"])

  .set("/import_file", ["p_admin"])
  .set("/download_report_template", ["p_admin"])
  .set("/delete_file", ["p_admin"])
  

  .set("/unknownscans_get",["p_scans"])
  .set("/webscans_get",["p_scans"])

  .set("/reports_get",["p_reports", "p_history"])
  .set("/reportsmeta_get",["p_reports"])
  .set("/reports_generate",["p_finance"])
  .set("/report_genforsubgroup",["p_reports"])
  .set("/report_export_local",["p_reports"])
  .set("/status_report_get_details",["p_reports"])
  .set("/download_pdf_report",["p_reports"])

  .set("/vacations_get",["p_vacations", "p_history"])
  .set("/vacations_get_alt",["p_vacations"])
  .set("/vacations_add",["p_vacations"])
  .set("/vacations_add_alt",["p_vacations"])
  .set("/vacations_edit",["p_vacations"])
  .set("/vacations_edit_alt",["p_vacations"])
  .set("/vacations_delete",["p_vacations"])
  .set("/vacations_delete_alt",["p_vacations"])

  .set("/vacationtype_get",["p_vacations","p_configs", "p_admin","p_reports"])
  .set("/vacationtype_get_inpure",["p_vacations","p_configs", "p_admin","p_reports"])
  .set("/vacationtype_get_pure",["p_vacations","p_configs", "p_admin","p_reports"])
  .set("/vacationtype_get_deactivated", ["p_admin"])
  .set("/vacationtype_add",["p_configs"])
  .set("/vacationtype_edit",["p_configs"])
  .set("/vacationtype_deactivate",["p_configs"])
  .set("/vacationtype_reactivate", ["p_admin"])
  .set("/vacationtype_remove",["p_configs"])

  .set("/editovertime_get",["p_editovertime"])
  .set("/editovertime_edit",["p_editovertime"])
  

  .set("/locations_get_deactivated", ["p_admin"])
  .set("/locations_get",["p_configs", "p_scans","p_emploees","p_terminals", "p_vacations", "p_reports", "p_history", "p_audit"])
  .set("/locations_add",["p_configs", "p_terminals"])
  .set("/locations_edit",["p_configs", "p_terminals"])
  .set("/users_reactivate",["p_advanced_users_edit", "p_admin"])
  .set("/locations_deactivate",["p_configs", "p_terminals"])
  .set("/locations_reactivate", ["p_admin"])
  .set("/locations_remove",["p_admin", "p_terminals"])

  .set("/terminals_get_deactivated", ["p_admin"])
  .set("/terminals_get",["p_terminals","p_configs", "p_admin"])
  .set("/terminals_add",["p_terminals"])
  .set("/terminals_edit",["p_terminals"])
  .set("/terminals_deactivate",["p_terminals"])
  .set("/terminals_reactivate", ["p_admin"])
  .set("/terminals_remove",["p_terminals"])

  .set("/holidays_get",["p_configs"])
  .set("/holidays_add",["p_configs"])
  .set("/holidays_edit",["p_configs"])
  .set("/holidays_remove",["p_configs"])

  .set("/editreasons_get",["p_configs","p_editclocking", "p_reports", "p_audit", "p_admin"])
  .set("/editreasons_get_deactivated", ["p_admin"])
  .set("/editreasons_add",["p_configs"])
  .set("/editreasons_edit",["p_configs"])
  .set("/editreasons_deactivate",["p_configs"])
  .set("/editreasons_reactivate", ["p_admin"])
  .set("/editreasons_remove", ["p_admin"])

  .set("/shifts_get",["p_configs", "p_emploees"])
  .set("/shifts_add",["p_configs"])
  .set("/shifts_edit",["p_configs"])
  .set("/shifts_deactivate",["p_configs"])
  .set("/shifts_remove",["p_configs"])
  .set("/shifts_get_unused",["p_configs"])

  .set("/shiftschedule_get",["p_emploees"])
  .set("/shiftschedule_add",["p_emploees"])
  .set("/shiftschedule_delete",["p_emploees"])
  .set("/shiftschedule_edit",["p_emploees"])
  .set("/shiftschedule_get_id",["p_emploees"])

  .set("/settings_get",["p_admin"])
  .set("/settings_edit",["p_admin"])
  .set("/admin_reset_resp_accounts",["p_admin"])

  .set("/permissions_get",["p_permissions", "p_emploees"])
  .set("/permissions_add",["p_permissions"])
  .set("/permissions_edit",["p_permissions"])
  .set("/permissions_remove",["p_permissions"])
  .set('/getallfinalizedstatus',["p_admin"])
  .set('/lockmonth',["p_finance"])
  .set('/unlockmonth',["p_finance"])
  .set('/downloadfinalizedarchive',["p_finance"])
  


  .set("/audit_get",["p_audit"])

  .set("/clockingchanges_get",["p_audit", "p_reports"])
  .set("/clockingchanges_add",["p_editclocking"])
  .set("/clockingchanges_edit",["p_editclocking"])

  .set("/clockinginvacation_get",["p_editclocking"])

  .set("/clocking_get_details",["p_clocking"])
  .set("/clocking_start",["p_clocking"])
  .set("/clocking_end",["p_clocking"])

  .set("/getdashdata2",["p_dashboard"])
  .set("/getdashdata3",["p_dashboard"])

  .set("/units_get",["p_departments"])
  .set("/units_edit",["p_departments"])
  .set("/units_add",["p_departments"])
  .set("/units_remove",["p_departments"])

  .set("/activities_get",["p_vacations", "p_history"])
	.set('/activities_add',["p_vacations"])
	.set('/activities_edit',["p_vacations"])
	.set('/activities_remove',["p_vacations"])
	.set('/activities_for_sg_add',["p_vacations"])
	.set('/activitytype_get',["p_vacations","p_configs", "p_history"])
	.set('/activitytype_edit',["p_vacations","p_configs"])

  .set("/groups_get",["p_departments", "p_emploees", "p_reports","p_history","p_vacations","p_audit"])
  .set("/groups_edit",["p_departments"])
  .set("/groups_remove",["p_departments"])
  .set("/groups_add",["p_departments"])

  .set("/subgroups_import", ["p_departments"])
  .set("/subgroups_get",["p_departments", "p_emploees", "p_reports","p_history","p_vacations","p_audit"])
  .set("/subgroups_get_with_transfer",["p_emploees","p_departments","p_history"])
  .set("/subgroups_add",["p_departments"])
  .set("/subgroups_edit",["p_departments"])

  .set("/subgroups_reps_get",["p_departments"])
  .set("/subgroups_reps_add",["p_departments"])
  .set("/subgroups_reps_remove",["p_departments"])
  .set("/subgroups_remove",["p_departments"])
  
  .set("/history_activities_get",["p_history"])
  .set("/history_vacations_get",["p_history"])
  .set("/history_scans_get",["p_history"])
  .set("/history_reports_get",["p_history"])
  .set("/history_reports_download",["p_history"])
  .set("/history_users_get",["p_history"])
  .set("/history_subgr_get",["p_history"])
  

  .set("/departmentnames",["p_departments","p_vacations", "p_reports", "p_history",  "p_emploees", "p_admin", "p_audit"])
  .set("/advancedtablequery",["p_finance"])
  .set("/tablenames",["p_finance"])
  .set("/errors_get",["p_audit"])
  .set("/log_file_get",["p_audit"])
  .set("/restricted_clockingchanges_get",["p_reports"])

  .set("/transferUnknownScans",["p_scans"])
  .set("/untransferedCards_get",["p_scans"])
  
  .set("/download_local_csv_report",["p_reports"])


module.exports = apiPermissions