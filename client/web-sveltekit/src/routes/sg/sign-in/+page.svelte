<script lang="ts">
</script>

<form method="POST">
    <label>
        <div>Username or email</div>
        <input name="username" required />
    </label>
    <label>
        <div>Password</div>
        <input name="passworrd" required type="password" />
    </label>
    <button type="submit">Sign in</button>
</form>

<style lang="scss">
    form {
        display: flex;
        flex-direction: column;
        background-color: white;
        padding: 1rem;
        border: 1px solid #444;
        border-radius: 4px;
        width: 20rem;
    }
</style>
