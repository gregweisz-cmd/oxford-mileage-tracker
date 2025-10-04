# Test Credentials for Portal Roles

## 🏢 Staff Portal (Employee Role)
**Email:** sarah.j@oxfordhouse.org  
**Password:** password123  
**Role:** Field Staff  
**Expected Portal:** Staff Portal (expense reports, settings, submissions)

---

## 👨‍💼 Supervisor Portal (Supervisor Role)  
**Email:** mike.r@oxfordhouse.org  
**Password:** password123  
**Role:** Senior Field Staff (configured as supervisor)  
**Expected Portal:** Supervisor Portal (team management, approvals)

---

## 🛠️ Alternative Test Approach

If the backend employee API isn't ready, you can also test by:

1. **Opening Browser Console** (F12)
2. **Running this code:**
```javascript
// Set test employee
localStorage.setItem('current_user', JSON.stringify({
  id: 'test-emp-001',
  name: 'Sarah Johnson',
  email: 'sarah.j@oxfordhouse.org',
  role: 'employee',
  position: 'Field Staff'
}));

// Refresh page - should show Staff Portal
location.reload();
```

```javascript
// Set test supervisor  
localStorage.setItem('current_user', JSON.stringify({
  id: 'test-sup-001',
  name: 'Mike Rodriguez',
  email: 'mike.r@oxfordhouse.org', 
  role: 'supervisor',
  position: 'Supervisor'
}));

// Refresh page - should show Supervisor Portal
location.reload();
```

---

## 🎯 What to Test:

### Staff Portal:
✅ Expense report creation/editing  
✅ User settings (cost centers, addresses)  
✅ Monthly report submissions  
✅ Dashboard tiles  

### Supervisor Portal:
✅ Team dashboard overview  
✅ Report review and approval  
✅ Team member management  
✅ Comments and feedback system
